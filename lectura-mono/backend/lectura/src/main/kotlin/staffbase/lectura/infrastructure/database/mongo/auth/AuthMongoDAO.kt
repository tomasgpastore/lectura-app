package staffbase.lectura.infrastructure.database.mongo.auth

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.auth.AuthToken
import staffbase.lectura.dao.AuthDAO

@Repository
@Profile("remote")
class AuthMongoDAO(
    private val authRepo: AuthMongoRepository
) : AuthDAO {

    override fun add(authToken: AuthToken): Boolean {
        authRepo.save(authToken)
        return true
    }

    override fun update(tokenId: String, updated: AuthToken): Boolean {
        return if (authRepo.existsById(tokenId)) {
            authRepo.save(updated)
            true
        } else {
            false
        }
    }

    override fun getById(tokenId: String): AuthToken? {
        return authRepo.findById(tokenId).orElse(null)
    }

    override fun getByRefreshToken(refreshToken: String): AuthToken? {
        return authRepo.findByRefreshToken(refreshToken)
    }

    override fun deleteByTokenId(tokenId: String): Boolean {
        return if (authRepo.existsById(tokenId)) {
            authRepo.deleteById(tokenId)
            true
        } else {
            false
        }
    }

    override fun revokeByTokenId(tokenId: String): Boolean {
        val token = getById(tokenId) ?: return false
        val updated = token.copy(isRevoked = true)
        return update(tokenId, updated)
    }
}
