package staffbase.lectura.exception

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import staffbase.lectura.ai.EmbeddingProcessTimeoutException

data class ErrorResponse(
    val message: String,
    val status: Int,
    val error: String,
    val details: Map<String, Any?>? = null
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
    
    @ExceptionHandler(SubscriptionLimitException::class)
    fun handleSubscriptionLimit(ex: SubscriptionLimitException): ResponseEntity<ErrorResponse> {
        val errorResponse = ErrorResponse(
            message = ex.reason,
            status = HttpStatus.PAYMENT_REQUIRED.value(),
            error = "SUBSCRIPTION_LIMIT_EXCEEDED",
            details = mapOf(
                "limit" to ex.limit,
                "current" to ex.current,
                "requiredPlan" to ex.requiredPlan?.name
            )
        )
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(errorResponse)
    }
    
    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(ex: IllegalArgumentException): ResponseEntity<ErrorResponse> {
        val errorResponse = ErrorResponse(
            message = ex.message ?: "Invalid request",
            status = HttpStatus.BAD_REQUEST.value(),
            error = "BAD_REQUEST"
        )
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse)
    }
}