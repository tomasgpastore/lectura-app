package staffbase.lectura.infrastructure.database.mongo.chat

import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.data.mongodb.repository.Query

interface AgentStateRepository : MongoRepository<AgentStateDocument, String> {
    @Query("{ 'threadId': ?0 }")
    fun findByThreadId(threadId: String): AgentStateDocument?
    
    @Query("{ 'userId': ?0, 'courseId': ?1 }")
    fun findByUserIdAndCourseId(userId: String, courseId: String): AgentStateDocument?
}