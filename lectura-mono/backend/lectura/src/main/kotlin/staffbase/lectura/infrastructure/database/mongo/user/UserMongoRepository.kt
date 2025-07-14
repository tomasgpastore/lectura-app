package staffbase.lectura.infrastructure.database.mongo.user

import org.springframework.data.mongodb.repository.MongoRepository
import staffbase.lectura.auth.AuthProvider
import staffbase.lectura.user.User

interface UserMongoRepository : MongoRepository<User, String> {
    // Query Derivation
    fun findByEmail(email: String): User?
    fun findByProviderAndProviderId(provider: AuthProvider, providerId: String): User?
}