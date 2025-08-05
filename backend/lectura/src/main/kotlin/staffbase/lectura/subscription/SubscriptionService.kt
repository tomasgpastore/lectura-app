package staffbase.lectura.subscription

import com.stripe.Stripe
import com.stripe.model.Customer
import com.stripe.model.Event
import com.stripe.model.checkout.Session
import com.stripe.model.billingportal.Session as BillingPortalSession
import com.stripe.param.CustomerCreateParams
import com.stripe.param.checkout.SessionCreateParams
import com.stripe.param.billingportal.SessionCreateParams as BillingPortalSessionCreateParams
import com.stripe.net.Webhook
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import staffbase.lectura.dao.UserDAO
import staffbase.lectura.dao.SubscriptionTierDAO
import org.slf4j.LoggerFactory
import java.time.Instant

@Service
class SubscriptionService(
    private val userDAO: UserDAO,
    private val subscriptionTierDAO: SubscriptionTierDAO,
    @Value("\${STRIPE_API_KEY}") private val stripeApiKey: String,
    @Value("\${STRIPE_WEBHOOK_SECRET}") private val stripeWebhookSecret: String,
    @Value("\${FRONTEND_URL}") private val frontendUrl: String
) {
    private val logger = LoggerFactory.getLogger(SubscriptionService::class.java)

    init {
        Stripe.apiKey = stripeApiKey
    }

    suspend fun createCheckoutSession(userId: String, tierName: String): String {
        val user = userDAO.getById(userId) ?: throw IllegalArgumentException("User not found")
        
        val subscriptionTier = getSubscriptionTier(tierName)
        val priceId = subscriptionTier.stripePriceId

        val customer = findOrCreateStripeCustomer(user.email, userId)

        val sessionParams = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
            .addLineItem(
                SessionCreateParams.LineItem.builder()
                    .setPrice(priceId)
                    .setQuantity(1)
                    .build()
            )
            .setCustomer(customer.id)
            .setSuccessUrl("$frontendUrl/subscription/success?session_id={CHECKOUT_SESSION_ID}")
            .setCancelUrl("$frontendUrl/subscription/cancel")
            .putMetadata("userId", userId)
            .putMetadata("tierName", tierName)
            .build()

        val session = Session.create(sessionParams)
        return session.url
    }

    suspend fun createBillingPortalSession(userId: String): String {
        val user = userDAO.getById(userId) ?: throw IllegalArgumentException("User not found")
        
        val customer = findStripeCustomer(user.email) 
            ?: throw IllegalArgumentException("Customer not found in Stripe")

        val sessionParams = BillingPortalSessionCreateParams.builder()
            .setCustomer(customer.id)
            .setReturnUrl("$frontendUrl/subscription/manage")
            .build()

        val session = BillingPortalSession.create(sessionParams)
        return session.url
    }

    suspend fun handleWebhookEvent(payload: String, signature: String): Event {
        val event = try {
            Webhook.constructEvent(payload, signature, stripeWebhookSecret)
        } catch (e: Exception) {
            logger.error("Webhook error: ${e.message}")
            throw e
        }

        when (event.type) {
            "checkout.session.completed" -> handleCheckoutSessionCompleted(event)
            "customer.subscription.created" -> handleSubscriptionCreated(event)
            "customer.subscription.updated" -> handleSubscriptionUpdated(event)
            "customer.subscription.deleted" -> handleSubscriptionDeleted(event)
            "invoice.payment_succeeded" -> handleInvoicePaymentSucceeded(event)
            "invoice.payment_failed" -> handleInvoicePaymentFailed(event)
            "customer.subscription.trial_will_end" -> handleTrialWillEnd(event)
            else -> logger.info("Unhandled event type: ${event.type}")
        }

        return event
    }

    private suspend fun handleCheckoutSessionCompleted(event: Event) {
        val session = event.dataObjectDeserializer.`object`.get() as Session
        val userId = session.metadata["userId"]
        val tierName = session.metadata["tierName"]
        
        if (userId != null && tierName != null) {
            updateUserSubscriptionStatus(userId, SubscriptionStatus.ACTIVE, tierName)
            logger.info("Checkout completed for user: $userId, tier: $tierName")
        }
    }

    private suspend fun handleSubscriptionCreated(event: Event) {
        val subscription = event.dataObjectDeserializer.`object`.get() as com.stripe.model.Subscription
        val customerId = subscription.customer
        val user = findUserByStripeCustomerId(customerId)
        
        if (user != null) {
            updateUserSubscriptionStatus(user.id, SubscriptionStatus.ACTIVE, subscription.id)
            logger.info("Subscription created for user: ${user.id}")
        }
    }

    private suspend fun handleSubscriptionUpdated(event: Event) {
        val subscription = event.dataObjectDeserializer.`object`.get() as com.stripe.model.Subscription
        val customerId = subscription.customer
        val user = findUserByStripeCustomerId(customerId)
        
        if (user != null) {
            val status = when (subscription.status) {
                "active" -> SubscriptionStatus.ACTIVE
                "past_due" -> SubscriptionStatus.PAST_DUE
                "canceled" -> SubscriptionStatus.CANCELED
                "incomplete" -> SubscriptionStatus.INCOMPLETE
                "incomplete_expired" -> SubscriptionStatus.EXPIRED
                "trialing" -> SubscriptionStatus.TRIALING
                "unpaid" -> SubscriptionStatus.UNPAID
                else -> SubscriptionStatus.UNKNOWN
            }
            updateUserSubscriptionStatus(user.id, status, subscription.id)
            logger.info("Subscription updated for user: ${user.id}, status: $status")
        }
    }

    private suspend fun handleSubscriptionDeleted(event: Event) {
        val subscription = event.dataObjectDeserializer.`object`.get() as com.stripe.model.Subscription
        val customerId = subscription.customer
        val user = findUserByStripeCustomerId(customerId)
        
        if (user != null) {
            updateUserSubscriptionStatus(user.id, SubscriptionStatus.CANCELED, subscription.id)
            logger.info("Subscription canceled for user: ${user.id}")
        }
    }

    private suspend fun handleInvoicePaymentSucceeded(event: Event) {
        val invoice = event.dataObjectDeserializer.`object`.get() as com.stripe.model.Invoice
        val customerId = invoice.customer
        val user = findUserByStripeCustomerId(customerId)
        
        if (user != null) {
            logger.info("Payment succeeded for user: ${user.id}")
        }
    }

    private suspend fun handleInvoicePaymentFailed(event: Event) {
        val invoice = event.dataObjectDeserializer.`object`.get() as com.stripe.model.Invoice
        val customerId = invoice.customer
        val user = findUserByStripeCustomerId(customerId)
        
        if (user != null) {
            updateUserSubscriptionStatus(user.id, SubscriptionStatus.PAYMENT_FAILED, null)
            logger.warn("Payment failed for user: ${user.id}")
        }
    }

    private suspend fun handleTrialWillEnd(event: Event) {
        val subscription = event.dataObjectDeserializer.`object`.get() as com.stripe.model.Subscription
        val customerId = subscription.customer
        val user = findUserByStripeCustomerId(customerId)
        
        if (user != null) {
            logger.info("Trial will end soon for user: ${user.id}")
        }
    }

    private suspend fun findOrCreateStripeCustomer(email: String, userId: String): Customer {
        val user = userDAO.getById(userId) ?: throw IllegalArgumentException("User not found")
        
        // Check if user already has a Stripe customer ID
        if (user.stripeCustomerId != null) {
            return Customer.retrieve(user.stripeCustomerId)
        }
        
        val existingCustomer = findStripeCustomer(email)
        if (existingCustomer != null) {
            // Update user with existing customer ID
            val updatedUser = user.copy(stripeCustomerId = existingCustomer.id)
            userDAO.update(userId, updatedUser)
            return existingCustomer
        }

        val customerParams = CustomerCreateParams.builder()
            .setEmail(email)
            .putMetadata("userId", userId)
            .build()

        val customer = Customer.create(customerParams)
        
        // Update user with new customer ID
        val updatedUser = user.copy(stripeCustomerId = customer.id)
        userDAO.update(userId, updatedUser)
        
        return customer
    }

    private fun findStripeCustomer(email: String): Customer? {
        val customers = Customer.list(
            mapOf("email" to email, "limit" to 1)
        )
        return customers.data.firstOrNull()
    }

    private suspend fun findUserByStripeCustomerId(customerId: String): staffbase.lectura.user.User? {
        val customer = Customer.retrieve(customerId)
        val userId = customer.metadata["userId"]
        return userId?.let { userDAO.getById(it) }
    }

    private suspend fun updateUserSubscriptionStatus(userId: String, status: SubscriptionStatus, subscriptionIdOrTier: String?) {
        val user = userDAO.getById(userId) ?: return
        val updatedUser = user.copy(
            subscriptionStatus = status.name,
            subscriptionId = if (status == SubscriptionStatus.ACTIVE && subscriptionIdOrTier?.startsWith("sub_") == true) subscriptionIdOrTier else user.subscriptionId,
            subscriptionTier = if (status == SubscriptionStatus.ACTIVE && subscriptionIdOrTier?.startsWith("sub_") != true) subscriptionIdOrTier else user.subscriptionTier,
            subscriptionExpiresAt = if (status == SubscriptionStatus.ACTIVE) {
                Instant.now().plusSeconds(30 * 24 * 60 * 60) // 30 days from now
            } else user.subscriptionExpiresAt
        )
        userDAO.update(userId, updatedUser)
        logger.info("Updated user $userId subscription status to $status")
    }

    private suspend fun getSubscriptionTier(tierName: String): SubscriptionTierDocument {
        return subscriptionTierDAO.findByName(tierName)
            ?: throw IllegalArgumentException("Subscription tier not found: $tierName")
    }

    suspend fun getAvailableTiers(): List<SubscriptionTierDocument> {
        return subscriptionTierDAO.findAll().filter { it.isActive }
    }
    
    suspend fun getUserSubscriptionStatus(userId: String): UserSubscriptionStatus {
        val user = userDAO.getById(userId) ?: throw IllegalArgumentException("User not found")
        
        return UserSubscriptionStatus(
            hasActiveSubscription = user.subscriptionStatus == SubscriptionStatus.ACTIVE.name,
            subscriptionStatus = user.subscriptionStatus,
            subscriptionTier = user.subscriptionTier,
            subscriptionExpiresAt = user.subscriptionExpiresAt
        )
    }
}

data class UserSubscriptionStatus(
    val hasActiveSubscription: Boolean,
    val subscriptionStatus: String?,
    val subscriptionTier: String?,
    val subscriptionExpiresAt: Instant?
)

enum class SubscriptionStatus {
    ACTIVE,
    PAST_DUE,
    CANCELED,
    INCOMPLETE,
    EXPIRED,
    TRIALING,
    UNPAID,
    PAYMENT_FAILED,
    UNKNOWN
}