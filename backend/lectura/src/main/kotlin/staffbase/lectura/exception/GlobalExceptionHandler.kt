package staffbase.lectura.exception

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import staffbase.lectura.ai.EmbeddingProcessTimeoutException

data class ErrorResponse(
    val message: String,
    val status: Int,
    val error: String
)

@ControllerAdvice
class GlobalExceptionHandler {
    
    @ExceptionHandler(EmbeddingProcessTimeoutException::class)
    fun handleEmbeddingProcessTimeout(ex: EmbeddingProcessTimeoutException): ResponseEntity<ErrorResponse> {
        val errorResponse = ErrorResponse(
            message = ex.message ?: "Embedding process timeout",
            status = HttpStatus.SERVICE_UNAVAILABLE.value(),
            error = "SERVICE_UNAVAILABLE"
        )
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(errorResponse)
    }
    
    // You can add more exception handlers here for other custom exceptions
}