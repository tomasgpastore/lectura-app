package staffbase.lectura.infrastructure.database.mongo.chat

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.JsonNode
import org.springframework.context.annotation.Profile
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatTurn
import staffbase.lectura.dao.ChatDAO
import staffbase.lectura.dto.ai.RagSource
import staffbase.lectura.dto.ai.WebSource
import staffbase.lectura.dto.ai.ImageSource
import java.time.Instant

@Component
@Profile("remote")
class ChatMongoDAO(
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
    private val agentStateRepo: AgentStateRepository
) : ChatDAO {

    override fun addMessage(userId: String, courseId: String, chatTurn: ChatTurn) {
        // DO NOT WRITE - AI service handles all message persistence
        // This method is kept for backward compatibility but does nothing
    }

    override fun getLastMessages(userId: String, courseId: String, limit: Int): List<ChatMessage> {
        val redisKey = "agent_state:$userId:$courseId"
        val sourcesKey = "agent_sources:$userId:$courseId"

        // Try to get from Redis first
        val cachedState = redisTemplate.opsForValue().get(redisKey)
        
        val messages = if (cachedState != null) {
            // Parse cached messages from Redis format (only contains messages array)
            try {
                val jsonNode = objectMapper.readTree(cachedState)
                val messagesNode = jsonNode.get("messages")
                if (messagesNode != null && messagesNode.isArray) {
                    convertJsonNodesToChatMessages(messagesNode)
                } else {
                    println("No messages array found in Redis cache")
                    fetchFromMongoAndCache(userId, courseId, sourcesKey)
                }
            } catch (e: Exception) {
                println("Error parsing cached messages: ${e.message}")
                fetchFromMongoAndCache(userId, courseId, sourcesKey)
            }
        } else {
            // Fetch from MongoDB and cache
            fetchFromMongoAndCache(userId, courseId, sourcesKey)
        }
        
        // Return the requested number of messages (newest first)
        return messages.take(limit)
    }
    
    private fun fetchFromMongoAndCache(
        userId: String, 
        courseId: String, 
        sourcesKey: String
    ): List<ChatMessage> {
        val threadId = "$userId:$courseId"
        println("Fetching from MongoDB with threadId: $threadId")
        val agentState = agentStateRepo.findByThreadId(threadId)
        
        return if (agentState != null) {
            println("Found agent state with ${agentState.messages.size} messages")
            // DO NOT WRITE - only read from MongoDB
            convertAgentMessagesToChatMessages(agentState.messages, sourcesKey)
        } else {
            println("No agent state found for threadId: $threadId")
            emptyList()
        }
    }
    
    private fun convertJsonNodesToChatMessages(
        messagesNode: JsonNode
    ): List<ChatMessage> {
        println("\\nConverting JsonNode messages from cache...")
        val messages = mutableListOf<ChatMessage>()
        
        // Create a map for message lookup
        val messageMap = mutableMapOf<String, JsonNode>()
        var toolMessageCount = 0
        messagesNode.forEach { node ->
            val id = node.get("id")?.asText()
            val type = node.get("type")?.asText()
            if (id != null) {
                messageMap[id] = node
                if (type == "tool") {
                    toolMessageCount++
                    println("  Tool message in cache: id=$id, name=${node.get("name")?.asText()}")
                }
            }
        }
        
        println("  Total messages in cache: ${messagesNode.size()}")
        println("  Tool messages in map: $toolMessageCount")
        println("  Message map size: ${messageMap.size}")
        
        messagesNode.forEachIndexed { index, msgNode ->
            val type = msgNode.get("type")?.asText() ?: return@forEachIndexed
            
            when (type) {
                "human" -> {
                    messages.add(
                        ChatMessage(
                            role = "user",
                            content = msgNode.get("content")?.asText() ?: "",
                            ragSources = emptyList(),
                            webSources = emptyList(),
                            imageSources = emptyList(),
                            timestamp = Instant.now()
                        )
                    )
                }
                "ai" -> {
                    val content = msgNode.get("content")?.asText() ?: ""
                    // Skip AI messages with empty content (tool calls)
                    if (content.isBlank()) {
                        println("  Skipping AI message #$index with empty content")
                        return@forEachIndexed
                    }
                    
                    println("\\n  Processing AI message #$index from cache")
                    // Resolve source references
                    val (ragSources, webSources, imageSources) = resolveJsonNodeSources(msgNode, messageMap)
                    
                    messages.add(
                        ChatMessage(
                            role = "assistant",
                            content = content,
                            ragSources = ragSources,
                            webSources = webSources,
                            imageSources = imageSources,
                            timestamp = Instant.now()
                        )
                    )
                }
                // Skip tool messages
                "tool" -> {
                    println("  Skipping tool message #$index: id=${msgNode.get("id")?.asText()}")
                    return@forEachIndexed
                }
            }
        }
        
        println("\\n  Converted to ${messages.size} chat messages from cache")
        return messages.reversed() // Reverse to get newest first
    }
    
    private fun resolveJsonNodeSources(
        aiNode: JsonNode,
        messageMap: Map<String, JsonNode>
    ): Triple<List<RagSource>, List<WebSource>, List<ImageSource>> {
        val ragSources = mutableListOf<RagSource>()
        val webSources = mutableListOf<WebSource>()
        val imageSources = mutableListOf<ImageSource>()
        
        val content = aiNode.get("content")?.asText()?.take(50) ?: ""
        println("Resolving sources for AI JsonNode: content=$content...")
        println("  AI node fields: ${aiNode.fieldNames().asSequence().toList()}")
        
        // Process RAG source references
        val ragSourceIds = aiNode.get("rag_source_ids")
        if (ragSourceIds != null && ragSourceIds.isArray) {
            println("  Found rag_source_ids: ${ragSourceIds.map { it.asText() }}")
            ragSourceIds.forEach { idNode ->
                val sourceId = idNode.asText()
                val toolNode = messageMap[sourceId]
                if (toolNode != null) {
                    println("    Found tool message for RAG source: $sourceId")
                    val sources = parseJsonToolMessage(toolNode)
                    ragSources.addAll(sources.first)
                } else {
                    println("    Tool message not found for RAG source: $sourceId")
                }
            }
        }
        
        // Process Web source references
        val webSourceIds = aiNode.get("web_source_ids")
        if (webSourceIds != null && webSourceIds.isArray) {
            println("  Found web_source_ids: ${webSourceIds.map { it.asText() }}")
            webSourceIds.forEach { idNode ->
                val sourceId = idNode.asText()
                val toolNode = messageMap[sourceId]
                if (toolNode != null) {
                    println("    Found tool message for Web source: $sourceId")
                    val sources = parseJsonToolMessage(toolNode)
                    webSources.addAll(sources.second)
                } else {
                    println("    Tool message not found for Web source: $sourceId")
                }
            }
        }
        
        // Process Image source references
        val imageSourceIds = aiNode.get("image_source_ids")
        if (imageSourceIds != null && imageSourceIds.isArray) {
            println("  Found image_source_ids: ${imageSourceIds.map { it.asText() }}")
            imageSourceIds.forEach { idNode ->
                val sourceId = idNode.asText()
                val toolNode = messageMap[sourceId]
                if (toolNode != null) {
                    println("    Found tool message for Image source: $sourceId")
                    val imageData = parseJsonImageToolMessage(toolNode)
                    if (imageData != null) {
                        imageSources.add(imageData)
                    }
                } else {
                    println("    Tool message not found for Image source: $sourceId")
                }
            }
        }
        
        // If no source references found, try legacy embedded sources
        if (ragSources.isEmpty() && webSources.isEmpty()) {
            println("  No source references found, trying legacy embedded sources...")
            val embeddedSources = extractSourcesFromMessage(aiNode)
            if (embeddedSources.first.isNotEmpty() || embeddedSources.second.isNotEmpty()) {
                println("    Found embedded sources: RAG=${embeddedSources.first.size}, Web=${embeddedSources.second.size}")
                ragSources.addAll(embeddedSources.first)
                webSources.addAll(embeddedSources.second)
            }
        }
        
        // Process image source (directly embedded in AI message - singular)
        val imageSourceNode = aiNode.get("image_source")
        if (imageSourceNode != null && imageSourceNode.isObject) {
            println("  Found image_source in AI message")
            try {
                imageSources.add(
                    ImageSource(
                        id = "page",
                        type = "current",
                        messageId = null,
                        timestamp = null,
                        slideId = imageSourceNode.get("slide_id")?.asText(),
                        pageNumber = imageSourceNode.get("page_number")?.asInt()
                    )
                )
                println("    Added image source: slideId=${imageSourceNode.get("slide_id")?.asText()}, pageNumber=${imageSourceNode.get("page_number")?.asInt()}")
            } catch (e: Exception) {
                println("    Error parsing image source: ${e.message}")
            }
        }
        
        println("  Final sources: RAG=${ragSources.size}, Web=${webSources.size}, Image=${imageSources.size}")
        return Triple(ragSources, webSources, imageSources)
    }
    
    private fun parseJsonToolMessage(toolNode: JsonNode): Pair<List<RagSource>, List<WebSource>> {
        val ragSources = mutableListOf<RagSource>()
        val webSources = mutableListOf<WebSource>()
        
        try {
            val content = toolNode.get("content")?.asText() ?: return Pair(emptyList(), emptyList())
            val data = objectMapper.readTree(content)
            
            // Check if the tool call was successful
            val success = data.get("success")?.asBoolean(false) ?: false
            if (!success) {
                return Pair(emptyList(), emptyList())
            }
            
            val toolName = toolNode.get("name")?.asText()
            
            when (toolName) {
                "rag_search_tool" -> {
                    // Parse RAG sources
                    val results = data.get("results")
                    if (results != null && results.isArray) {
                        results.forEach { result ->
                            ragSources.add(
                                RagSource(
                                    id = result.get("id")?.asText() ?: "",
                                    slide = result.get("slide")?.asText() ?: "",
                                    s3file = result.get("s3file")?.asText() ?: "",
                                    start = result.get("start")?.asText() ?: "",
                                    end = result.get("end")?.asText() ?: "",
                                    text = result.get("text")?.asText() ?: ""
                                )
                            )
                        }
                    }
                }
                "web_search_tool" -> {
                    // Parse Web sources
                    val results = data.get("results")
                    if (results != null && results.isArray) {
                        results.forEach { result ->
                            webSources.add(
                                WebSource(
                                    id = result.get("id")?.asText() ?: "",
                                    title = result.get("title")?.asText() ?: "",
                                    url = result.get("url")?.asText() ?: "",
                                    text = result.get("text")?.asText() ?: ""
                                )
                            )
                        }
                    }
                }
            }
        } catch (e: Exception) {
            println("Error parsing JSON tool message: ${e.message}")
        }
        
        return Pair(ragSources, webSources)
    }
    
    private fun parseJsonImageToolMessage(toolNode: JsonNode): ImageSource? {
        try {
            val content = toolNode.get("content")?.asText() ?: return null
            val data = objectMapper.readTree(content)
            
            // Check if the tool call was successful
            val success = data.get("success")?.asBoolean(false) ?: false
            if (!success) {
                return null
            }
            
            val toolName = toolNode.get("name")?.asText()
            
            when (toolName) {
                "current_user_view", "previous_user_view" -> {
                    // Parse image source data
                    val slideId = data.get("slide_id")?.asText()
                    val pageNumber = data.get("page_number")?.asInt()
                    
                    return ImageSource(
                        id = "page",
                        type = if (toolName == "current_user_view") "current" else "previous",
                        messageId = null,
                        timestamp = null,
                        slideId = slideId,
                        pageNumber = pageNumber
                    )
                }
            }
        } catch (e: Exception) {
            println("Error parsing JSON image tool message: ${e.message}")
        }
        
        return null
    }
    
    private fun extractSourcesFromMessage(messageNode: JsonNode): Pair<List<RagSource>, List<WebSource>> {
        val sourcesNode = messageNode.get("sources") ?: return Pair(emptyList(), emptyList())
        
        val ragSources = mutableListOf<RagSource>()
        val webSources = mutableListOf<WebSource>()
        
        try {
            val ragSourcesNode = sourcesNode.get("rag_sources")
            if (ragSourcesNode != null && ragSourcesNode.isArray) {
                ragSourcesNode.forEach { src ->
                    ragSources.add(
                        RagSource(
                            id = src.get("id")?.asText() ?: "",
                            slide = src.get("slide")?.asText() ?: "",
                            s3file = src.get("s3file")?.asText() ?: "",
                            start = src.get("start")?.asText() ?: "",
                            end = src.get("end")?.asText() ?: "",
                            text = src.get("text")?.asText() ?: ""
                        )
                    )
                }
            }
            
            val webSourcesNode = sourcesNode.get("web_sources")
            if (webSourcesNode != null && webSourcesNode.isArray) {
                webSourcesNode.forEach { src ->
                    webSources.add(
                        WebSource(
                            id = src.get("id")?.asText() ?: "",
                            title = src.get("title")?.asText() ?: "",
                            url = src.get("url")?.asText() ?: "",
                            text = src.get("text")?.asText() ?: ""
                        )
                    )
                }
            }
        } catch (e: Exception) {
            println("Error extracting sources from message: ${e.message}")
        }
        
        return Pair(ragSources, webSources)
    }
    
    private fun convertAgentMessagesToChatMessages(
        agentMessages: List<AgentMessage>,
        sourcesKey: String
    ): List<ChatMessage> {
        println("Converting ${agentMessages.size} agent messages to chat messages")
        println("Message types: ${agentMessages.groupBy { it.type }.mapValues { it.value.size }}")
        
        // Create a map of all messages by ID for quick lookup
        val messageMap = agentMessages
            .filter { it.id != null }
            .associateBy { it.id!! }
        
        println("Created message map with ${messageMap.size} entries")
        
        val chatMessages = mutableListOf<ChatMessage>()
        
        for ((index, msg) in agentMessages.withIndex()) {
            when (msg.type) {
                "human" -> {
                    chatMessages.add(
                        ChatMessage(
                            role = "user",
                            content = msg.content,
                            ragSources = emptyList(),
                            webSources = emptyList(),
                            imageSources = emptyList(),
                            timestamp = Instant.now()
                        )
                    )
                }
                "ai" -> {
                    // Skip AI messages with empty content (tool calls)
                    if (msg.content.isBlank()) {
                        println("Skipping AI message #$index with empty content")
                        continue
                    }
                    
                    println("\nProcessing AI message #$index")
                    // Process AI message and resolve source references
                    val (ragSources, webSources, imageSources) = resolveSourceReferences(msg, messageMap, sourcesKey)
                    
                    chatMessages.add(
                        ChatMessage(
                            role = "assistant",
                            content = msg.content,
                            ragSources = ragSources,
                            webSources = webSources,
                            imageSources = imageSources,
                            timestamp = Instant.now()
                        )
                    )
                }
                // Skip tool messages - they're only used as source references
                "tool" -> {
                    println("Found tool message #$index: id=${msg.id}, name=${msg.name}")
                    continue
                }
            }
        }
        
        println("\nConverted to ${chatMessages.size} chat messages")
        return chatMessages.reversed() // Reverse to get newest first
    }
    
    private fun resolveSourceReferences(
        aiMessage: AgentMessage,
        messageMap: Map<String, AgentMessage>,
        sourcesKey: String
    ): Triple<List<RagSource>, List<WebSource>, List<ImageSource>> {
        val ragSources = mutableListOf<RagSource>()
        val webSources = mutableListOf<WebSource>()
        val imageSources = mutableListOf<ImageSource>()
        
        println("Resolving sources for AI message: id=${aiMessage.id}, content=${aiMessage.content.take(50)}...")
        println("  ragSourceIds: ${aiMessage.ragSourceIds}")
        println("  webSourceIds: ${aiMessage.webSourceIds}")
        println("  imageSourceIds: ${aiMessage.imageSourceIds}")
        println("  imageSource (direct): ${aiMessage.imageSource}")
        
        // Process RAG source references
        aiMessage.ragSourceIds?.forEach { sourceId ->
            println("  Looking up RAG source: $sourceId")
            val toolMessage = messageMap[sourceId]
            if (toolMessage != null) {
                println("    Found tool message: ${toolMessage.name}")
                val sources = parseToolMessage(toolMessage)
                ragSources.addAll(sources.first)
            } else {
                println("    Tool message not found in map")
            }
        }
        
        // Process Web source references
        aiMessage.webSourceIds?.forEach { sourceId ->
            println("  Looking up Web source: $sourceId")
            val toolMessage = messageMap[sourceId]
            if (toolMessage != null) {
                println("    Found tool message: ${toolMessage.name}")
                val sources = parseToolMessage(toolMessage)
                webSources.addAll(sources.second)
            } else {
                println("    Tool message not found in map")
            }
        }
        
        // Process Image source references
        aiMessage.imageSourceIds?.forEach { sourceId ->
            println("  Looking up Image source: $sourceId")
            val toolMessage = messageMap[sourceId]
            if (toolMessage != null) {
                println("    Found tool message for image: ${toolMessage.name}")
                val imageData = parseImageToolMessage(toolMessage)
                if (imageData != null) {
                    imageSources.add(imageData)
                }
            } else {
                println("    Tool message not found for image source: $sourceId")
            }
        }
        
        // If no source references found, try legacy approaches
        if (ragSources.isEmpty() && webSources.isEmpty()) {
            println("  No source references found, trying legacy approaches...")
            
            // First try embedded sources (legacy format)
            val embeddedSources = extractSourcesFromAgentMessage(aiMessage)
            if (embeddedSources.first.isNotEmpty() || embeddedSources.second.isNotEmpty()) {
                println("    Found embedded sources: RAG=${embeddedSources.first.size}, Web=${embeddedSources.second.size}")
                ragSources.addAll(embeddedSources.first)
                webSources.addAll(embeddedSources.second)
            }
            
            // Then try Redis hash (old format)
            if (ragSources.isEmpty() && webSources.isEmpty() && aiMessage.id != null) {
                println("    Trying Redis hash for message ID: ${aiMessage.id}")
                val redisSources = getSourcesForMessage(sourcesKey, aiMessage.id)
                if (redisSources.first.isNotEmpty() || redisSources.second.isNotEmpty()) {
                    println("    Found Redis sources: RAG=${redisSources.first.size}, Web=${redisSources.second.size}")
                    ragSources.addAll(redisSources.first)
                    webSources.addAll(redisSources.second)
                }
            }
        }
        
        // Also check for direct image_source field in the AI message (singular)
        aiMessage.imageSource?.let { imageMap ->
            println("  Found direct image_source in AI message")
            try {
                val imageSource = ImageSource(
                    id = "page",
                    type = "current",
                    messageId = null,
                    timestamp = null,
                    slideId = imageMap["slide_id"]?.toString(),
                    pageNumber = imageMap["page_number"]?.toString()?.toIntOrNull()
                )
                imageSources.add(imageSource)
                println("    Added image source: slideId=${imageSource.slideId}, pageNumber=${imageSource.pageNumber}")
            } catch (e: Exception) {
                println("    Error parsing image source: ${e.message}")
            }
        }
        
        println("  Final sources: RAG=${ragSources.size}, Web=${webSources.size}, Image=${imageSources.size}")
        return Triple(ragSources, webSources, imageSources)
    }
    
    private fun parseToolMessage(toolMessage: AgentMessage): Pair<List<RagSource>, List<WebSource>> {
        val ragSources = mutableListOf<RagSource>()
        val webSources = mutableListOf<WebSource>()
        
        try {
            // Parse JSON content from tool message
            val data = objectMapper.readTree(toolMessage.content)
            
            // Check if the tool call was successful
            val success = data.get("success")?.asBoolean(false) ?: false
            if (!success) {
                return Pair(emptyList(), emptyList())
            }
            
            when (toolMessage.name) {
                "rag_search_tool" -> {
                    // Parse RAG sources
                    val results = data.get("results")
                    if (results != null && results.isArray) {
                        results.forEach { result ->
                            ragSources.add(
                                RagSource(
                                    id = result.get("id")?.asText() ?: "",
                                    slide = result.get("slide")?.asText() ?: "",
                                    s3file = result.get("s3file")?.asText() ?: "",
                                    start = result.get("start")?.asText() ?: "",
                                    end = result.get("end")?.asText() ?: "",
                                    text = result.get("text")?.asText() ?: ""
                                )
                            )
                        }
                    }
                }
                "web_search_tool" -> {
                    // Parse Web sources
                    val results = data.get("results")
                    if (results != null && results.isArray) {
                        results.forEach { result ->
                            webSources.add(
                                WebSource(
                                    id = result.get("id")?.asText() ?: "",
                                    title = result.get("title")?.asText() ?: "",
                                    url = result.get("url")?.asText() ?: "",
                                    text = result.get("text")?.asText() ?: ""
                                )
                            )
                        }
                    }
                }
                // Add other tool types as needed (current_user_view, previous_user_view, etc.)
            }
        } catch (e: Exception) {
            println("Error parsing tool message ${toolMessage.id}: ${e.message}")
        }
        
        return Pair(ragSources, webSources)
    }
    
    private fun parseImageToolMessage(toolMessage: AgentMessage): ImageSource? {
        try {
            // Parse JSON content from tool message
            val data = objectMapper.readTree(toolMessage.content)
            
            // Check if the tool call was successful
            val success = data.get("success")?.asBoolean(false) ?: false
            if (!success) {
                return null
            }
            
            when (toolMessage.name) {
                "current_user_view", "previous_user_view" -> {
                    // Parse image source data
                    val s3key = data.get("s3key")?.asText()
                    val slideId = data.get("slide_id")?.asText()
                    val pageNumber = data.get("page_number")?.asInt()
                    
                    return ImageSource(
                        id = "page",
                        type = if (toolMessage.name == "current_user_view") "current" else "previous",
                        messageId = null,
                        timestamp = null,
                        slideId = slideId,
                        pageNumber = pageNumber
                    )
                }
            }
        } catch (e: Exception) {
            println("Error parsing image tool message ${toolMessage.id}: ${e.message}")
        }
        
        return null
    }
    
    private fun extractSourcesFromAgentMessage(msg: AgentMessage): Pair<List<RagSource>, List<WebSource>> {
        val sources = msg.sources ?: return Pair(emptyList(), emptyList())
        
        val ragSources = mutableListOf<RagSource>()
        val webSources = mutableListOf<WebSource>()
        
        try {
            // Convert Map<String, Any> to RagSource
            sources.ragSources?.forEach { srcMap ->
                ragSources.add(
                    RagSource(
                        id = srcMap["id"]?.toString() ?: "",
                        slide = srcMap["slide"]?.toString() ?: "",
                        s3file = srcMap["s3file"]?.toString() ?: "",
                        start = srcMap["start"]?.toString() ?: "",
                        end = srcMap["end"]?.toString() ?: "",
                        text = srcMap["text"]?.toString() ?: ""
                    )
                )
            }
            
            // Convert Map<String, Any> to WebSource
            sources.webSources?.forEach { srcMap ->
                webSources.add(
                    WebSource(
                        id = srcMap["id"]?.toString() ?: "",
                        title = srcMap["title"]?.toString() ?: "",
                        url = srcMap["url"]?.toString() ?: "",
                        text = srcMap["text"]?.toString() ?: ""
                    )
                )
            }
        } catch (e: Exception) {
            println("Error extracting sources from agent message: ${e.message}")
        }
        
        return Pair(ragSources, webSources)
    }
    
    private fun getSourcesForMessage(
        sourcesKey: String,
        messageId: String
    ): Pair<List<RagSource>, List<WebSource>> {
        try {
            val sourcesJson = redisTemplate.opsForHash<String, String>().get(sourcesKey, messageId)
            if (sourcesJson != null) {
                val sourcesMap = objectMapper.readValue(sourcesJson, Map::class.java)
                
                @Suppress("UNCHECKED_CAST")
                val ragSources = (sourcesMap["rag_sources"] as? List<Map<String, Any>>)?.map { src ->
                    RagSource(
                        id = src["id"]?.toString() ?: "",
                        slide = src["slide"]?.toString() ?: "",
                        s3file = src["s3file"]?.toString() ?: "",
                        start = src["start"]?.toString() ?: "",
                        end = src["end"]?.toString() ?: "",
                        text = src["text"]?.toString() ?: ""
                    )
                } ?: emptyList()
                
                @Suppress("UNCHECKED_CAST")
                val webSources = (sourcesMap["web_sources"] as? List<Map<String, Any>>)?.map { src ->
                    WebSource(
                        id = src["id"]?.toString() ?: "",
                        title = src["title"]?.toString() ?: "",
                        url = src["url"]?.toString() ?: "",
                        text = src["text"]?.toString() ?: ""
                    )
                } ?: emptyList()
                
                return Pair(ragSources, webSources)
            }
        } catch (e: Exception) {
            println("Error getting sources for message $messageId: ${e.message}")
        }
        
        return Pair(emptyList(), emptyList())
    }

    override fun deleteAll(userId: String, courseId: String) {
        // Delete Redis caches
        redisTemplate.delete("agent_state:$userId:$courseId")
        redisTemplate.delete("agent_sources:$userId:$courseId")
        redisTemplate.delete("agent_images:$userId:$courseId")
        
        // Delete from MongoDB
        val threadId = "$userId:$courseId"
        try {
            val agentState = agentStateRepo.findByThreadId(threadId)
            if (agentState != null) {
                agentStateRepo.delete(agentState)
                println("Deleted agent state from MongoDB for threadId: $threadId")
            } else {
                println("No agent state found in MongoDB for threadId: $threadId")
            }
        } catch (e: Exception) {
            println("Error deleting from MongoDB: ${e.message}")
        }
    }
}