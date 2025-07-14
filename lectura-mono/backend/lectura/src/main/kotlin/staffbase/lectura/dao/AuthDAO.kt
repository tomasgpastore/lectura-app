package staffbase.lectura.dao

import staffbase.lectura.auth.AuthToken

interface AuthDAO {
    fun add(authToken: AuthToken): Boolean
    fun update(tokenId: String, updated: AuthToken): Boolean
    fun getById(tokenId: String): AuthToken?
    fun getByRefreshToken(refreshToken: String): AuthToken?
    fun deleteByTokenId(tokenId: String): Boolean
    fun revokeByTokenId(tokenId: String): Boolean
    // Include MongoDB TTL indexes to remove expired tokens automatically
    // fun revokeAllByUserID -> to be implemented for log out every device
}