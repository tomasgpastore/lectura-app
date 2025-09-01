package staffbase.lectura.user

import org.springframework.stereotype.Service
import staffbase.lectura.auth.AuthProvider
import staffbase.lectura.dao.AuthDAO
import staffbase.lectura.dao.UserDAO
import java.util.UUID

@Service
class UserService(
    private val userDAO: UserDAO,
    private val authDAO: AuthDAO,
){

    /*
    fun getAllUser(): List<User>{
        return userDAO.getAllUsers()
    }
     */

    fun findOrCreateUser(provider: AuthProvider, providerId: String, email : String, picture: String) : User {
        return userDAO.getByProviderAndId(provider, providerId)
            ?: run {
                val newUser = User(
                    id = UUID.randomUUID().toString(),
                    provider = provider,
                    providerId = providerId,
                    email = email,
                    courseId = emptyList(),
                    picture = picture,
                )
                userDAO.add(newUser)
                newUser
            }
    }

    fun getUserById(userId: String): User? {
        return userDAO.getById(userId)
    }

    /*
    fun getUserByEmail(email: String): User? {
        return userDAO.getByEmail(email)
    }
     */

    fun updateUser(userId: String, updatedUser: User): Boolean {
        return userDAO.update(userId, updatedUser)
    }

    fun anyUserInCourse(courseId: String): Boolean {
        return userDAO.getAllUsers().any { courseId in it.courseId }
    }
}