package staffbase.lectura.infrastructure.database.local

import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.auth.AuthToken
import staffbase.lectura.course.Course
import staffbase.lectura.slide.Slide
import staffbase.lectura.user.User
import java.util.concurrent.ConcurrentHashMap

object DataStore {
    val users = mutableListOf<User>()
    val courses = mutableListOf<Course>()
    val slides = mutableListOf<Slide>()
    val authtokens = mutableListOf<AuthToken>()
    val messages = ConcurrentHashMap<String, MutableList<ChatMessage>>()

}