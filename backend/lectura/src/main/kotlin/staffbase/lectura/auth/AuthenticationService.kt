package staffbase.lectura.auth

import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Service

@Service
class AuthenticationService {
    
    fun getCurrentUserId(): String? {
        val authentication = SecurityContextHolder.getContext().authentication
        return authentication?.principal as? String
    }
    
    fun requireCurrentUserId(): String {
        return getCurrentUserId() ?: throw IllegalStateException("User not authenticated")
    }
    
    fun isAuthenticated(): Boolean {
        val authentication = SecurityContextHolder.getContext().authentication
        return authentication != null && authentication.isAuthenticated && authentication.principal is String
    }
}