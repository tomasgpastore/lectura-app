package staffbase.lectura.auth

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.TimeUnit

@Service
class CsrfTokenService(
    private val redisTemplate: StringRedisTemplate
) {
    companion object {
        private const val CSRF_TOKEN_PREFIX = "csrf:"
        private const val TOKEN_LENGTH = 32
        private const val TOKEN_TTL_HOURS = 24L
    }
    
    private val secureRandom = SecureRandom()
    private val base64Encoder = Base64.getUrlEncoder().withoutPadding()
    
    fun generateToken(userId: String): String {
        val tokenBytes = ByteArray(TOKEN_LENGTH)
        secureRandom.nextBytes(tokenBytes)
        val token = base64Encoder.encodeToString(tokenBytes)
        
        // Store token in Redis with user association
        val key = "$CSRF_TOKEN_PREFIX$userId"
        redisTemplate.opsForValue().set(key, token, TOKEN_TTL_HOURS, TimeUnit.HOURS)
        
        return token
    }
    
    fun validateToken(userId: String, token: String?): Boolean {
        if (token.isNullOrBlank()) {
            return false
        }
        
        val key = "$CSRF_TOKEN_PREFIX$userId"
        val storedToken = redisTemplate.opsForValue().get(key)
        
        return token == storedToken
    }
    
    fun refreshToken(userId: String): String {
        // Generate new token and update expiration
        return generateToken(userId)
    }
    
    fun deleteToken(userId: String) {
        val key = "$CSRF_TOKEN_PREFIX$userId"
        redisTemplate.delete(key)
    }
}