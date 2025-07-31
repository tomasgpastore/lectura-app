package staffbase.lectura.ai

import com.fasterxml.jackson.annotation.JsonProperty
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.HttpStatusCodeException
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatService
import staffbase.lectura.dto.ai.ChatOutboundDTO
import staffbase.lectura.dto.ai.ChatResponseDTO
import java.net.HttpURLConnection
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.data.web.JsonPath
import staffbase.lectura.ai.chat.ChatTurn
import java.net.URI
import java.time.Instant

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
    private val objectMapper: ObjectMapper
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
                                        // Save conversation to Redis and complete stream
                                        saveConversationToRedis(userId, courseId, userPrompt, aiResponseBuilder.toString())
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
        snapshot: String? = null,
        priorityDocuments: List<String>? = null
    ): ChatResponseDTO {
        // Build the outbound request payload
        val request = ChatOutboundDTO(
            courseId   = courseId,
            userId     = userId,
            userPrompt   = userPrompt,
            snapshot = snapshot
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

        val aiAnswer = objectMapper.readValue(responseJson, ChatResponseDTO::class.java)

        saveConversationToRedis(userId, courseId, userPrompt, aiAnswer.response, aiAnswer.data)
        // Deserialize into ChatResponseDTO and return
        return aiAnswer
    }

    
    private fun saveConversationToRedis(userId: String, courseId: String, userPrompt: String, aiResponse: String, sources: List<Source>) {
        try {
            // Save user message
            val userMessage = ChatMessage(
                role = "user",
                content = userPrompt,
                timestamp = Instant.now()
            )

            // Save AI response
            val assistantMessage = ChatMessage(
                role = "assistant",
                content = aiResponse,
                sources = sources,
                timestamp = Instant.now()
            )

            val chatTurn = ChatTurn(
                userMessage = userMessage,
                userId = userId,
                courseId = courseId,
                assistantMessage = assistantMessage
            )

            chatService.addMessage(userId, courseId, chatTurn)
            
        } catch (e: Exception) {
            // Log error but don't fail the stream
            println("Error saving conversation to Redis: ${e.message}")
        }
    }
}