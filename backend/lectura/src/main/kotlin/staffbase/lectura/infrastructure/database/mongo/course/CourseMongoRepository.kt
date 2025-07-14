package staffbase.lectura.infrastructure.database.mongo.course

import org.springframework.data.mongodb.repository.MongoRepository
import staffbase.lectura.course.Course

interface CourseMongoRepository : MongoRepository<Course, String> {
    fun findByIdAndDeletedAtIsNull(id: String): Course?
    fun existsByIdAndDeletedAtIsNull(id: String): Boolean
}
