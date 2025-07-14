package staffbase.lectura.infrastructure.database.local

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.auth.AuthProvider
import staffbase.lectura.user.User
import staffbase.lectura.dao.UserDAO

@Repository
@Profile("local")
class UserInMemoryDAO : UserDAO {

    override fun getAllUsers(): List<User> {
        return DataStore.users
    }

    override fun getById(userId: String): User? {
        return DataStore.users.find { it.id == userId }
    }

    override fun getByProviderAndId(provider: AuthProvider, providerId: String): User? {
        return DataStore.users.find { it.provider == provider && it.providerId == providerId }
    }

    override fun getByEmail(email: String): User? {
        return DataStore.users.find { it.email == email }
    }

    override fun add(user: User): Boolean {
        if (DataStore.users.any { it.id == user.id }) return false
        return DataStore.users.add(user)
    }

    override fun update(userId: String, updated: User): Boolean {
        val index = DataStore.users.indexOfFirst { it.id == userId }
        return if (index != -1) {
            DataStore.users[index] = updated
            true
        } else false
    }

}