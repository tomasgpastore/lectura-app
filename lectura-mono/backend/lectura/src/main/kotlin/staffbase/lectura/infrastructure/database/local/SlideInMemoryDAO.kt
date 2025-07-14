package staffbase.lectura.infrastructure.database.local

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.slide.Slide
import staffbase.lectura.dao.SlideDAO

@Repository
@Profile("local")
class SlideInMemoryDAO : SlideDAO {

    override fun getById(slideId: String): Slide? {
        return DataStore.slides.find { it.id == slideId }
    }

    override fun add(slide: Slide): Boolean {
        return DataStore.slides.add(slide)
    }

    override fun update(slideId: String, updated: Slide): Boolean {
        val index = DataStore.slides.indexOfFirst { it.id == slideId }
        return if (index != -1) {
            DataStore.slides[index] = updated
            true
        } else {
            false
        }
    }

    override fun delete(slideId: String): Boolean {
        return DataStore.slides.removeIf { it.id == slideId }
    }

    override fun exists(slideId: String): Boolean {
        return DataStore.slides.any { it.id == slideId }
    }

}