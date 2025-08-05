package staffbase.lectura.infrastructure.database.mongo.slide

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.dao.SlideDAO
import staffbase.lectura.slide.Slide

@Repository
@Profile("remote")
class SlideMongoDAO(
    private val slideRepo: SlideMongoRepository
) : SlideDAO {

    override fun getById(slideId: String): Slide? {
        return slideRepo.findById(slideId).orElse(null)
    }

    override fun add(slide: Slide): Boolean {
        slideRepo.save(slide)
        return true
    }

    override fun update(slideId: String, updated: Slide): Boolean {
        return if (slideRepo.existsById(slideId)) {
            slideRepo.save(updated)
            true
        } else {
            false
        }
    }

    override fun delete(slideId: String): Boolean {
        return if (slideRepo.existsById(slideId)) {
            slideRepo.deleteById(slideId)
            true
        } else {
            false
        }
    }

    override fun exists(slideId: String): Boolean {
        return slideRepo.existsById(slideId)
    }
    
    override suspend fun countByCourseId(courseId: String): Int {
        return slideRepo.countByCourseId(courseId).toInt()
    }
}