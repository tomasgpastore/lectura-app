package staffbase.lectura.infrastructure.database.mongo.auth

import org.springframework.data.mongodb.repository.MongoRepository
import staffbase.lectura.auth.AuthToken

interface AuthMongoRepository : MongoRepository<AuthToken, String> {
    // Query Derivation
    fun findByRefreshToken(refreshToken: String): AuthToken?
}