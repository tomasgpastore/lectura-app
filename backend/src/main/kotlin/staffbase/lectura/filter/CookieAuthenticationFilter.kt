package staffbase.lectura.filter

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import staffbase.lectura.auth.CookieService
import staffbase.lectura.auth.JwtService
import staffbase.lectura.user.UserService

@Component
class CookieAuthenticationFilter(
    private val cookieService: CookieService,
    private val jwtService: JwtService,
    private val userService: UserService
) : OncePerRequestFilter() {
    
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        try {
            // Skip authentication for public endpoints
            if (shouldSkipAuthentication(request)) {
                filterChain.doFilter(request, response)
                return
            }
            
            // Get token from cookie only
            val token = cookieService.getAccessTokenFromRequest(request)
            
            if (token != null && SecurityContextHolder.getContext().authentication == null) {
                val userId = jwtService.extractUserId(token)
                
                if (jwtService.isTokenValid(token, userId)) {
                    val user = userService.getUserById(userId)
                    
                    if (user != null) {
                        val authToken = UsernamePasswordAuthenticationToken(
                            user.id,
                            null,
                            emptyList()
                        )
                        authToken.details = WebAuthenticationDetailsSource().buildDetails(request)
                        SecurityContextHolder.getContext().authentication = authToken
                    }
                }
            }
        } catch (e: Exception) {
            logger.error("Cannot set user authentication: ${e.message}")
        }
        
        filterChain.doFilter(request, response)
    }
    
    private fun shouldSkipAuthentication(request: HttpServletRequest): Boolean {
        val path = request.servletPath
        val method = request.method
        
        // Public endpoints that don't require authentication
        val publicEndpoints = listOf(
            "/auth/google",
            "/auth/v2/google",
            "/auth/refresh",
            "/auth/v2/refresh",
            "/health",
            "/actuator"
        )
        
        return publicEndpoints.any { path.startsWith(it) } ||
               (method == "OPTIONS") // Allow CORS preflight requests
    }
}