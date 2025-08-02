package staffbase.lectura.auth

import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Service
import staffbase.lectura.dto.auth.AuthResponseDTO
import staffbase.lectura.dto.auth.CookieAuthResponseDTO
import staffbase.lectura.common.Constants
import staffbase.lectura.dao.AuthDAO
import staffbase.lectura.dto.auth.UserResponseDTO
import staffbase.lectura.user.User
import staffbase.lectura.user.UserService


@Service
class AuthService(
    private val googleVerifier: GoogleVerifierService,
    private val userService: UserService,
    private val refreshTokenService: RefreshTokenService,
    private val jwtService: JwtService,
    private val authDAO: AuthDAO,
    private val cookieService: CookieService,
    private val csrfTokenService: CsrfTokenService
    ) {

    fun loginWithGoogle(idToken: String): AuthResponseDTO {
        val payload = googleVerifier.verify(idToken)

        val providerId = payload.subject
        val email = payload["email"] as String
        val rawPicture = payload["picture"] as? String

        val picture = if (!rawPicture.isNullOrBlank()) rawPicture else Constants.DEFAULT_PROFILE_PICTURE_URL

        val user: User = userService.findOrCreateUser(AuthProvider.GOOGLE, providerId, email, picture)

        if (user.picture != picture) {
            val updatedUser = user.copy(picture = picture)
            userService.updateUser(user.id, updatedUser)
        }

        val accessToken = jwtService.createAccessToken(user.id)
        val refreshToken = refreshTokenService.generateAndStoreRefreshToken(user.id)

        return AuthResponseDTO(
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
    }

    fun refreshToken(refreshToken: String): AuthResponseDTO {

        val newToken = refreshTokenService.validateAndRotate(refreshToken)
        val user = userService.getUserById(newToken.userId) ?: throw IllegalArgumentException("User not found")

        val accessToken = jwtService.createAccessToken(user.id)
        val refreshToken = newToken.refreshToken

        return AuthResponseDTO(
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
    }

    fun getCurrentUser(accessToken: String): UserResponseDTO {
        val userId = jwtService.extractUserIdFromHeader(accessToken)
        val user = userService.getUserById(userId) ?: throw IllegalArgumentException("User not found")
        return UserResponseDTO(
            email = user.email,
            picture = user.picture,
        )
    }

    fun logout(refreshToken: String) {
        refreshTokenService.delete(refreshToken)

        /*
        refreshTokenService.revoke (refreshToken) // If audit of refreshTokens needed
         */
    }
    
    // Cookie-based authentication methods
    fun loginWithGoogleCookie(idToken: String, response: HttpServletResponse): CookieAuthResponseDTO {
        val payload = googleVerifier.verify(idToken)

        val providerId = payload.subject
        val email = payload["email"] as String
        val rawPicture = payload["picture"] as? String

        val picture = if (!rawPicture.isNullOrBlank()) rawPicture else Constants.DEFAULT_PROFILE_PICTURE_URL

        val user: User = userService.findOrCreateUser(AuthProvider.GOOGLE, providerId, email, picture)

        if (user.picture != picture) {
            val updatedUser = user.copy(picture = picture)
            userService.updateUser(user.id, updatedUser)
        }

        // Generate tokens
        val accessToken = jwtService.createAccessToken(user.id)
        val refreshToken = refreshTokenService.generateAndStoreRefreshToken(user.id)
        
        // Set cookies
        cookieService.addAccessTokenCookie(response, accessToken)
        cookieService.addRefreshTokenCookie(response, refreshToken)
        
        // Generate CSRF token
        val csrfToken = csrfTokenService.generateToken(user.id)

        return CookieAuthResponseDTO(
            csrfToken = csrfToken,
            user = UserResponseDTO(
                email = user.email,
                picture = user.picture
            )
        )
    }
    
    fun refreshTokenCookie(refreshTokenValue: String, response: HttpServletResponse): CookieAuthResponseDTO {
        val newToken = refreshTokenService.validateAndRotate(refreshTokenValue)
        val user = userService.getUserById(newToken.userId) ?: throw IllegalArgumentException("User not found")

        val accessToken = jwtService.createAccessToken(user.id)
        val refreshToken = newToken.refreshToken
        
        // Update cookies
        cookieService.addAccessTokenCookie(response, accessToken)
        cookieService.addRefreshTokenCookie(response, refreshToken)
        
        // Refresh CSRF token
        val csrfToken = csrfTokenService.refreshToken(user.id)

        return CookieAuthResponseDTO(
            csrfToken = csrfToken,
            user = UserResponseDTO(
                email = user.email,
                picture = user.picture
            )
        )
    }
    
    fun logoutCookie(refreshTokenValue: String, userId: String, response: HttpServletResponse) {
        refreshTokenService.delete(refreshTokenValue)
        csrfTokenService.deleteToken(userId)
        cookieService.clearAuthCookies(response)
    }

}