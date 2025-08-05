package staffbase.lectura.infrastructure.database.mongo.chat

import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.data.mongodb.repository.Query
import staffbase.lectura.ai.chat.ChatTurn

interface ChatMongoRepository : MongoRepository<ChatTurn, String> {
    @Query("{ 'userId': ?0, 'courseId': ?1 }")
    fun findByUserIdAndCourseId(userId: String, courseId: String): List<ChatTurn>

}
