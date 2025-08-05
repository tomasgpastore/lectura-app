package staffbase.lectura.infrastructure.database.mongo.slide

import org.springframework.data.mongodb.repository.MongoRepository
import staffbase.lectura.slide.Slide

interface SlideMongoRepository : MongoRepository<Slide, String> {
    fun countByCourseId(courseId: String): Long
}