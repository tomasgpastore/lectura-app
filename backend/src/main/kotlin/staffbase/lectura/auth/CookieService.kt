package staffbase.lectura.auth

import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Service
import staffbase.lectura.config.CookieConfig

@Service
class CookieService(
    private val cookieConfig: CookieConfig
) {
    
    fun createAccessTokenCookie(token: String): Cookie {
        return createCookie(
            name = cookieConfig.accessTokenName,
            value = token,
            maxAge = cookieConfig.accessTokenMaxAge
        )
    }
    
    fun createRefreshTokenCookie(token: String): Cookie {
        return createCookie(
            name = cookieConfig.refreshTokenName,
            value = token,
            maxAge = cookieConfig.refreshTokenMaxAge
        )
    }
    
    fun addAccessTokenCookie(response: HttpServletResponse, token: String) {
        response.addCookie(createAccessTokenCookie(token))
    }
    
    fun addRefreshTokenCookie(response: HttpServletResponse, token: String) {
        response.addCookie(createRefreshTokenCookie(token))
    }
    
    fun getAccessTokenFromRequest(request: HttpServletRequest): String? {
        return getCookieValue(request, cookieConfig.accessTokenName)
    }
    
    fun getRefreshTokenFromRequest(request: HttpServletRequest): String? {
        return getCookieValue(request, cookieConfig.refreshTokenName)
    }
    
    fun clearAuthCookies(response: HttpServletResponse) {
        // Create cookies with maxAge = 0 to delete them
        val accessCookie = createCookie(cookieConfig.accessTokenName, "", 0)
        val refreshCookie = createCookie(cookieConfig.refreshTokenName, "", 0)
        
        response.addCookie(accessCookie)
        response.addCookie(refreshCookie)
    }
    
    private fun createCookie(name: String, value: String, maxAge: Int): Cookie {
        return Cookie(name, value).apply {
            this.maxAge = maxAge
            this.path = cookieConfig.path
            this.isHttpOnly = cookieConfig.httpOnly
            this.secure = cookieConfig.secure
            
            // Set SameSite attribute
            if (cookieConfig.sameSite.isNotBlank()) {
                setAttribute("SameSite", cookieConfig.sameSite)
            }
            
            // Set domain if specified
            if (cookieConfig.domain.isNotBlank()) {
                this.domain = cookieConfig.domain
            }
        }
    }
    
    private fun getCookieValue(request: HttpServletRequest, cookieName: String): String? {
        return request.cookies?.firstOrNull { it.name == cookieName }?.value
    }
}