package staffbase.lectura.dao

import staffbase.lectura.auth.AuthProvider
import staffbase.lectura.user.User

interface UserDAO {
    fun getAllUsers(): List<User>
    fun getById(userId: String): User?
    fun getByProviderAndId(provider: AuthProvider, providerId: String): User?
    fun getByEmail(email: String): User?
    fun add(user: User): Boolean
    fun update(userId: String, updated: User): Boolean
}