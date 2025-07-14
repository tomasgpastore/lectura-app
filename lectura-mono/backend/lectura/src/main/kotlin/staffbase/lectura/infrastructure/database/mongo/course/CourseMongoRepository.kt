package staffbase.lectura.infrastructure.database.mongo.course

import org.springframework.data.mongodb.repository.MongoRepository
import staffbase.lectura.course.Course

interface CourseMongoRepository : MongoRepository<Course, String> {}
