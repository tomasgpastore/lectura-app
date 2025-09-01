package staffbase.lectura.infrastructure.database.local

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.auth.AuthToken
import staffbase.lectura.dao.AuthDAO

@Repository
@Profile("local")
class AuthInMemoryDAO: AuthDAO {

    override fun add(authToken: AuthToken): Boolean {
        return DataStore.authtokens.add(authToken)
    }

    override fun update(tokenId: String, updated: AuthToken): Boolean {
        val index = DataStore.authtokens.indexOfFirst { it.tokenId == tokenId }
        return if (index != -1) {
            DataStore.authtokens[index] = updated
            true
        } else {
            false
        }
    }

    override fun getById(tokenId: String): AuthToken? {
        return DataStore.authtokens.find { it.tokenId == tokenId }
    }

    override fun getByRefreshToken(refreshToken: String): AuthToken? {
        return DataStore.authtokens.find { it.refreshToken == refreshToken }
    }

    override fun deleteByTokenId(tokenId: String): Boolean {
        return DataStore.authtokens.removeIf { it.tokenId == tokenId }
    }

    override fun revokeByTokenId(tokenId: String): Boolean {
        val token = getById(tokenId) ?: return false
        val updatedToken = token.copy(isRevoked = true)

        return update(tokenId, updatedToken)
    }
}