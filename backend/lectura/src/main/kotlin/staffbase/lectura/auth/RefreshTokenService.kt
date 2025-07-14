package staffbase.lectura.auth

import org.springframework.stereotype.Service
import staffbase.lectura.dao.AuthDAO
import java.security.SecureRandom
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.*

@Service
class RefreshTokenService(private val authDAO: AuthDAO) {
    private val secureRandom = SecureRandom()
    private val expirationDays = 30L

    fun generateAndStoreRefreshToken(userId: String): String {
        val refreshToken = generateSecureToken()
        val tokenId = UUID.randomUUID().toString()
        val expiration = Instant.now().plus(expirationDays, ChronoUnit.DAYS)

        val authToken = AuthToken(
            tokenId = tokenId,
            userId = userId,
            refreshToken = refreshToken,
            createdAt = Instant.now(),
            expiresAt = expiration,
            isRevoked = false
        )

        if (!authDAO.add(authToken)) {
            throw IllegalStateException("Failed to store refresh token")
        }

        return refreshToken
    }

    fun validateAndRotate(refreshToken: String): AuthToken {
        val token = authDAO.getByRefreshToken(refreshToken)
            ?: throw IllegalArgumentException("Invalid refresh token")

        if (token.isRevoked || token.expiresAt.isBefore(Instant.now())) {
            throw IllegalArgumentException("Expired or revoked refresh token")
        }

        // Revoke or Delete old token
        authDAO.deleteByTokenId(token.tokenId)

        /*
        authTokenDAO.revokeByTokenId(token.tokenId)
         */

        // Issue new token
        val newToken = AuthToken(
            tokenId = UUID.randomUUID().toString(),
            userId = token.userId,
            refreshToken = generateSecureToken(),
            createdAt = Instant.now(),
            expiresAt = Instant.now().plus(expirationDays, ChronoUnit.DAYS),
            isRevoked = false
        )

        if (!authDAO.add(newToken)) {
            throw IllegalStateException("Failed to store new refresh token")
        }

        return newToken
    }

    /*
    fun revoke(refreshToken: String) {
        val token = authTokenDAO.getByRefreshToken(refreshToken)
            ?: throw IllegalArgumentException("Invalid refresh token")

        authTokenDAO.revokeByTokenId(token.tokenId)
    }
     */

    fun delete(refreshToken: String) {
        val token = authDAO.getByRefreshToken(refreshToken)
            ?: throw IllegalArgumentException("Invalid refresh token")

        authDAO.deleteByTokenId(token.tokenId)
    }

    private fun generateSecureToken(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun getRefreshTokenByUserId(userId: String): String {
        val token = authDAO.getById(userId)
            ?: throw IllegalArgumentException("Refresh token not found for user")
        return token.refreshToken
    }
}