package staffbase.lectura.infrastructure.database.mongo.subscription

import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.stereotype.Repository
import staffbase.lectura.subscription.SubscriptionTierDocument

@Repository
interface SubscriptionTierMongoRepository : MongoRepository<SubscriptionTierDocument, String> {
    fun findByName(name: String): SubscriptionTierDocument?
}