package staffbase.lectura.filter

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import staffbase.lectura.auth.CsrfTokenService
import com.fasterxml.jackson.databind.ObjectMapper

@Component
class CsrfValidationFilter(
    private val csrfTokenService: CsrfTokenService,
    private val objectMapper: ObjectMapper
) : OncePerRequestFilter() {
    
    companion object {
        private const val CSRF_HEADER = "X-CSRF-Token"
        private val STATE_CHANGING_METHODS = setOf("POST", "PUT", "DELETE", "PATCH")
    }
    
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        // Skip CSRF validation for non-state-changing methods
        if (!STATE_CHANGING_METHODS.contains(request.method)) {
            filterChain.doFilter(request, response)
            return
        }
        
        // Skip CSRF validation for public endpoints
        if (shouldSkipCsrfValidation(request)) {
            filterChain.doFilter(request, response)
            return
        }
        
        // Get authenticated user
        val authentication = SecurityContextHolder.getContext().authentication
        if (authentication == null || !authentication.isAuthenticated) {
            filterChain.doFilter(request, response)
            return
        }
        
        val userId = authentication.principal as? String
        if (userId == null) {
            filterChain.doFilter(request, response)
            return
        }
        
        // Get CSRF token from header
        val csrfToken = request.getHeader(CSRF_HEADER)
        
        // Validate CSRF token
        if (!csrfTokenService.validateToken(userId, csrfToken)) {
            sendCsrfError(response)
            return
        }
        
        filterChain.doFilter(request, response)
    }
    
    private fun shouldSkipCsrfValidation(request: HttpServletRequest): Boolean {
        val path = request.servletPath
        
        // Endpoints that don't require CSRF validation
        val csrfExemptEndpoints = listOf(
            "/auth/google",
            "/auth/v2/google",
            "/auth/refresh",
            "/auth/v2/refresh",
            "/auth/logout",
            "/auth/v2/logout",
            "/actuator",
            "/health"
        )
        
        return csrfExemptEndpoints.any { path.startsWith(it) }
    }
    
    private fun sendCsrfError(response: HttpServletResponse) {
        response.status = HttpStatus.FORBIDDEN.value()
        response.contentType = "application/json"
        
        val errorResponse = mapOf(
            "error" to "CSRF_TOKEN_INVALID",
            "message" to "Invalid or missing CSRF token",
            "status" to HttpStatus.FORBIDDEN.value()
        )
        
        response.writer.write(objectMapper.writeValueAsString(errorResponse))
    }
}