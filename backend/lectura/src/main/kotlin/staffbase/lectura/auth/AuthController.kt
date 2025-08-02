package staffbase.lectura.auth

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import staffbase.lectura.dto.auth.AuthResponseDTO
import staffbase.lectura.dto.auth.CookieAuthResponseDTO
import staffbase.lectura.dto.auth.GoogleLoginRequestDTO
import staffbase.lectura.dto.auth.LogoutRequestDTO
import staffbase.lectura.dto.auth.RefreshRequestDTO
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
import staffbase.lectura.dto.auth.UserResponseDTO

@RestController
@RequestMapping("/auth")
class AuthController(
    private val authService: AuthService,
    private val cookieService: CookieService,
    private val jwtService: JwtService,
    private val authenticationService: AuthenticationService,
    private val userService: staffbase.lectura.user.UserService
){
    private val logger = LoggerFactory.getLogger(this::class.java)

    @PostMapping("/google")
    @ResponseStatus(HttpStatus.OK)
    fun logInWithGoogle(@RequestBody request: GoogleLoginRequestDTO): AuthResponseDTO {
        logger.info("Received Google login request with ID token: ${request.idToken}")
        return authService.loginWithGoogle(request.idToken)
    }

    @PostMapping("/refresh")
    @ResponseStatus(HttpStatus.OK)
    fun refreshToken(@RequestBody request: RefreshRequestDTO): AuthResponseDTO {
        return authService.refreshToken(request.refreshToken)
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.OK)
    fun logout(@RequestBody request: LogoutRequestDTO) {
        return authService.logout(request.refreshToken)
    }

    @GetMapping("/me")
    @ResponseStatus(HttpStatus.OK)
    fun getCurrentUser(): UserResponseDTO {
        val userId = authenticationService.requireCurrentUserId()
        val user = userService.getUserById(userId) ?: throw IllegalArgumentException("User not found")
        return UserResponseDTO(
            email = user.email,
            picture = user.picture
        )
    }
    
    // Cookie-based authentication endpoints (v2)
    @PostMapping("/v2/google")
    @ResponseStatus(HttpStatus.OK)
    fun logInWithGoogleCookie(
        @RequestBody request: GoogleLoginRequestDTO,
        response: HttpServletResponse
    ): CookieAuthResponseDTO {
        logger.info("Received Google login request (cookie-based)")
        return authService.loginWithGoogleCookie(request.idToken, response)
    }
    
    @PostMapping("/v2/refresh")
    @ResponseStatus(HttpStatus.OK)
    fun refreshTokenCookie(
        request: HttpServletRequest,
        response: HttpServletResponse
    ): CookieAuthResponseDTO {
        val refreshToken = cookieService.getRefreshTokenFromRequest(request)
            ?: throw IllegalArgumentException("Refresh token not found in cookie")
        
        return authService.refreshTokenCookie(refreshToken, response)
    }
    
    @PostMapping("/v2/logout")
    @ResponseStatus(HttpStatus.OK)
    fun logoutCookie(
        request: HttpServletRequest,
        response: HttpServletResponse
    ) {
        val refreshToken = cookieService.getRefreshTokenFromRequest(request)
        val accessToken = cookieService.getAccessTokenFromRequest(request)
        
        if (refreshToken != null && accessToken != null) {
            val userId = jwtService.extractUserId(accessToken)
            authService.logoutCookie(refreshToken, userId, response)
        } else {
            // Clear cookies anyway
            cookieService.clearAuthCookies(response)
        }
    }
    
    @GetMapping("/v2/me")
    @ResponseStatus(HttpStatus.OK)
    fun getCurrentUserCookie(request: HttpServletRequest): UserResponseDTO {
        val accessToken = cookieService.getAccessTokenFromRequest(request)
            ?: throw IllegalArgumentException("Access token not found in cookie")
            
        return authService.getCurrentUser("Bearer $accessToken")
    }
}