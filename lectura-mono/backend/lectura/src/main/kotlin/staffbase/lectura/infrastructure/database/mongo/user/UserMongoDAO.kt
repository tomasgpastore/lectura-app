package staffbase.lectura.infrastructure.database.mongo.user

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.auth.AuthProvider
import staffbase.lectura.dao.UserDAO
import staffbase.lectura.user.User

@Repository
@Profile("remote")
class UserMongoDAO(
    private val userRepo: UserMongoRepository
) : UserDAO {

    override fun getAllUsers(): List<User> {
        return userRepo.findAll()
    }

    override fun getById(userId: String): User? {
        return userRepo.findById(userId).orElse(null)
    }

    override fun getByProviderAndId(provider: AuthProvider, providerId: String): User? {
        return userRepo.findByProviderAndProviderId(provider, providerId)
    }

    override fun getByEmail(email: String): User? {
        return userRepo.findByEmail(email)
    }

    override fun add(user: User): Boolean {
        if (userRepo.existsById(user.id)) return false
        userRepo.save(user)
        return true
    }

    override fun update(userId: String, updated: User): Boolean {
        return if (userRepo.existsById(userId)) {
            userRepo.save(updated)
            true
        } else {
            false
        }
    }
}