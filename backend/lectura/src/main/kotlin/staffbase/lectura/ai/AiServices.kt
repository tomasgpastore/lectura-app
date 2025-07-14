package staffbase.lectura.ai

import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.HttpStatusCodeException
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatService
import staffbase.lectura.dto.ai.ChatOutboundDTO
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.util.concurrent.CompletableFuture
import com.fasterxml.jackson.databind.ObjectMapper
import java.net.URI

data class SlideProcessingRequest(
    val courseId: String,
    val slideId: String,
    val s3_fileName: String
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
                s3_fileName = s3FileName
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
                s3_fileName = s3FileName
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
    
    private fun saveConversationToRedis(userId: String, courseId: String, userPrompt: String, aiResponse: String) {
        try {
            // Save user message
            val userMessage = ChatMessage(
                role = "user",
                content = userPrompt,
                timestamp = System.currentTimeMillis()
            )

            // Save AI response
            val assistantMessage = ChatMessage(
                role = "assistant",
                content = aiResponse,
                timestamp = System.currentTimeMillis()
            )
            chatService.addMessage(userId, courseId, userMessage, assistantMessage)
            
        } catch (e: Exception) {
            // Log error but don't fail the stream
            println("Error saving conversation to Redis: ${e.message}")
        }
    }
}