package staffbase.lectura.auth

import org.springframework.stereotype.Service
import staffbase.lectura.dto.auth.AuthResponseDTO
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
    private val authDAO: AuthDAO
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

}