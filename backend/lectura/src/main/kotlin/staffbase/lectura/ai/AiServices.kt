package staffbase.lectura.ai

import com.fasterxml.jackson.annotation.JsonProperty
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.HttpStatusCodeException
import staffbase.lectura.ai.chat.ChatService
import staffbase.lectura.dto.ai.ChatOutboundDTO
import staffbase.lectura.dto.ai.ChatResponseDTO
import java.net.HttpURLConnection
import com.fasterxml.jackson.databind.ObjectMapper
import java.net.URI
import org.springframework.data.redis.core.StringRedisTemplate
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.delay

class EmbeddingProcessTimeoutException(message: String) : RuntimeException(message)

data class SlideProcessingRequest(
    @JsonProperty("course_id")
    val courseId: String,
    @JsonProperty("slide_id")
    val slideId: String,
    @JsonProperty("s3_file_name")
    val s3FileName: String
)

/*
    TODO: Implement these methods in the microservice (python microservice)
    fun generateSlideStudyGuide(){}
    fun generateSlidePracticeQuestions(){}
    fun generateSlideSummary(){}
    fun generateFlashCards(){}
*/

@Service
class EmbeddingProcessingService {
    
    private val restTemplate = RestTemplate()
    private val baseUrl = System.getenv("AI_MICROSERVICE_URL")
    
    fun processSlideEmbeddings(courseId: String, slideId: String, s3FileName: String): Boolean {
        return try {
            val headers = HttpHeaders().apply {
                contentType = MediaType.APPLICATION_JSON
            }
            
            val request = SlideProcessingRequest(
                courseId = courseId,
                slideId = slideId,
                s3FileName = s3FileName
            )
            
            val entity = HttpEntity(request, headers)
            val response = restTemplate.postForEntity("$baseUrl/inbound", entity, String::class.java)
            
            response.statusCode.is2xxSuccessful
        } catch (e: HttpStatusCodeException) {
            false
        } catch (e: Exception) {
            false
        }
    }
    
    fun deleteSlideEmbeddings(courseId: String, slideId: String, s3FileName: String): Boolean {
        return try {
            val headers = HttpHeaders().apply {
                contentType = MediaType.APPLICATION_JSON
            }
            
            val request = SlideProcessingRequest(
                courseId = courseId,
                slideId = slideId,
                s3FileName = s3FileName
            )
            
            val entity = HttpEntity(request, headers)
            val response = restTemplate.exchange(
                "$baseUrl/management", 
                HttpMethod.DELETE, 
                entity, 
                String::class.java
            )
            
            response.statusCode.is2xxSuccessful
        } catch (e: HttpStatusCodeException) {
            false
        } catch (e: Exception) {
            false
        }
    }
}

@Service
class AiChatService(
    private val chatService: ChatService,
    private val objectMapper: ObjectMapper,
    private val redisTemplate: StringRedisTemplate
) {
    
    private val baseUrl = System.getenv("AI_MICROSERVICE_URL")


    /*
    // Streaming response generateAnswer method
    fun generateAnswer(
        userId: String,
        courseId: String,
        userPrompt: String,
        snapshot: String? = null
    ): SseEmitter {
        val emitter = SseEmitter(300000L) // 5 minutes timeout
        val aiResponseBuilder = StringBuilder()
        
        CompletableFuture.runAsync {
            try {
                val request = ChatOutboundDTO(
                    course = courseId,
                    user = userId,
                    prompt = userPrompt,
                    snapshot = snapshot
                )

                val uri = URI("$baseUrl/outbound")
                val url = uri.toURL()
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Accept", "text/event-stream")
                connection.doOutput = true
                
                // Send request body
                connection.outputStream.use { os ->
                    val requestBody = objectMapper.writeValueAsString(request)
                    os.write(requestBody.toByteArray())
                }
                
                // Handle SSE response
                BufferedReader(InputStreamReader(connection.inputStream)).use { reader ->
                    var line: String?
                    var currentEvent: String? = null
                    
                    while (reader.readLine().also { line = it } != null) {
                        when {
                            line!!.startsWith("event:") -> {
                                currentEvent = line.substringAfter("event:").trim()
                            }
                            line.startsWith("data:") -> {
                                val data = line.substringAfter("data:").trim()
                                
                                when (currentEvent) {
                                    "sources" -> {
                                        // Forward sources event to frontend
                                        emitter.send(SseEmitter.event()
                                            .name("sources")
                                            .data(data))
                                    }
                                    "token" -> {
                                        // Collect AI response and forward to frontend
                                        aiResponseBuilder.append(data)
                                        emitter.send(SseEmitter.event()
                                            .name("token")
                                            .data(data))
                                    }
                                    "end" -> {
                                        // AI service handles persistence, just complete the stream
                                        emitter.send(SseEmitter.event()
                                            .name("end")
                                            .data(data))
                                        emitter.complete()
                                        return@use
                                    }
                                }
                            }
                            line.isEmpty() -> {
                                // Empty line resets current event
                                currentEvent = null
                            }
                        }
                    }
                }
                
            } catch (e: Exception) {
                emitter.completeWithError(e)
            }
        }
        
        return emitter
    }

     */

    // Non-streaming response generateAnswer method
    fun generateAnswer(
        userId: String,
        courseId: String,
        userPrompt: String,
        snapshots: List<String>,
        slidePriority: List<String>,
        searchType: SearchType,
    ): ChatResponseDTO {
        // Convert enum to string
        val searchTypeString = when (searchType) {
            SearchType.DEFAULT -> "DEFAULT"
            SearchType.RAG -> "RAG"
            SearchType.WEB -> "WEB"
            SearchType.RAG_WEB -> "RAG_WEB"
        }
        
        // If using RAG or RAG_WEB, wait for any ongoing embedding processes
        if (searchType == SearchType.RAG || searchType == SearchType.RAG_WEB) {
            waitForEmbeddingProcesses(userId, courseId)
        }

        // Build the outbound request payload
        val request = ChatOutboundDTO(
            courseId = courseId,
            userId = userId,
            userPrompt = userPrompt,
            slidePriority = slidePriority,
            searchType = searchTypeString,
            snapshots = snapshots
        )

        // Open and configure the HTTP connection
        val uri = URI("$baseUrl/outbound")
        val connection = (uri.toURL().openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            doOutput = true
        }

        // Serialize and send the request body
        connection.outputStream.use { os ->
            val json = objectMapper.writeValueAsString(request)
            os.write(json.toByteArray(Charsets.UTF_8))
        }

        // Read the full JSON response
        val responseJson = connection.inputStream.bufferedReader().use { it.readText() }

        // Deserialize into ChatResponseDTO and return
        // This includes response, ragSources, and webSources
        return objectMapper.readValue(responseJson, ChatResponseDTO::class.java)
    }
    
    private fun waitForEmbeddingProcesses(userId: String, courseId: String) {
        val pattern = "embedding_process:$userId:$courseId:*"
        val maxWaitTime = 60_000L // 60 seconds max wait
        val checkInterval = 500L // Check every 500ms
        val startTime = System.currentTimeMillis()
        
        runBlocking {
            while (System.currentTimeMillis() - startTime < maxWaitTime) {
                // Check if any embedding processes are running for this user and course
                val keys = redisTemplate.keys(pattern)
                
                if (keys.isEmpty()) {
                    // No ongoing processes
                    println("No ongoing embedding processes for user $userId in course $courseId")
                    return@runBlocking
                }
                
                println("Found ${keys.size} ongoing embedding processes, waiting...")
                
                // Wait before checking again
                delay(checkInterval)
            }
            
            // If we've reached this point, we've timed out
            throw EmbeddingProcessTimeoutException("Timeout waiting for embedding processes to complete for user $userId in course $courseId. Please try again later.")
        }
    }
}