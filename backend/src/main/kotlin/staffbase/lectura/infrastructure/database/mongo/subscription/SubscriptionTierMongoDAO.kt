package staffbase.lectura.infrastructure.database.mongo.subscription

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.dao.SubscriptionTierDAO
import staffbase.lectura.subscription.SubscriptionTierDocument

@Repository
@Profile("remote")
class SubscriptionTierMongoDAO(
    private val repository: SubscriptionTierMongoRepository
) : SubscriptionTierDAO {

    override suspend fun findByName(name: String): SubscriptionTierDocument? {
        return repository.findByName(name)
    }

    override suspend fun findById(id: String): SubscriptionTierDocument? {
        return repository.findById(id).orElse(null)
    }

    override suspend fun findAll(): List<SubscriptionTierDocument> {
        return repository.findAll()
    }

    override suspend fun save(tier: SubscriptionTierDocument): SubscriptionTierDocument {
        return repository.save(tier)
    }

    override suspend fun deleteById(id: String): Boolean {
        return try {
            repository.deleteById(id)
            true
        } catch (e: Exception) {
            false
        }
    }
}