package staffbase.lectura.subscription

import org.springframework.stereotype.Service
import staffbase.lectura.dao.CourseDAO
import staffbase.lectura.dao.SlideDAO
import staffbase.lectura.dao.UserDAO
import org.springframework.data.redis.core.StringRedisTemplate
import java.time.LocalDate
import java.time.ZoneOffset

@Service
class SubscriptionLimitService(
    private val subscriptionService: SubscriptionService,
    private val userDAO: UserDAO,
    private val courseDAO: CourseDAO,
    private val slideDAO: SlideDAO,
    private val redisTemplate: StringRedisTemplate
) {
    
    suspend fun checkCourseCreationLimit(userId: String): SubscriptionCheckResult {
        val userPlan = getUserPlan(userId)
        val limits = SubscriptionLimits.getLimits(userPlan)
        
        // Get user and count their courses
        val user = userDAO.getById(userId)
        val currentCount = user?.courseId?.size ?: 0
        
        return if (currentCount >= limits.maxCourses) {
            SubscriptionCheckResult(
                allowed = false,
                reason = "Course creation limit reached",
                limit = limits.maxCourses,
                current = currentCount,
                requiredPlan = SubscriptionPlan.PREMIUM
            )
        } else {
            SubscriptionCheckResult(allowed = true)
        }
    }
    
    suspend fun checkFileUploadLimit(userId: String, courseId: String): SubscriptionCheckResult {
        val userPlan = getUserPlan(userId)
        val limits = SubscriptionLimits.getLimits(userPlan)
        
        val courseSlidesCount = slideDAO.countByCourseId(courseId)
        
        return if (courseSlidesCount >= limits.maxFilesPerCourse) {
            SubscriptionCheckResult(
                allowed = false,
                reason = "File upload limit per course reached",
                limit = limits.maxFilesPerCourse,
                current = courseSlidesCount,
                requiredPlan = SubscriptionPlan.PREMIUM
            )
        } else {
            SubscriptionCheckResult(allowed = true)
        }
    }
    
    suspend fun checkMessageLimit(userId: String): SubscriptionCheckResult {
        val userPlan = getUserPlan(userId)
        val limits = SubscriptionLimits.getLimits(userPlan)
        
        // Premium users have unlimited messages
        if (limits.maxMessagesPerDay == null) {
            return SubscriptionCheckResult(allowed = true)
        }
        
        val today = LocalDate.now().toString()
        val key = "messages:$userId:$today"
        val currentCount = redisTemplate.opsForValue().get(key)?.toIntOrNull() ?: 0
        
        return if (currentCount >= limits.maxMessagesPerDay) {
            SubscriptionCheckResult(
                allowed = false,
                reason = "Daily message limit reached",
                limit = limits.maxMessagesPerDay,
                current = currentCount,
                requiredPlan = SubscriptionPlan.PREMIUM
            )
        } else {
            SubscriptionCheckResult(allowed = true)
        }
    }
    
    suspend fun incrementMessageCount(userId: String) {
        val today = LocalDate.now().toString()
        val key = "messages:$userId:$today"
        val ttl = LocalDate.now().plusDays(1).atStartOfDay().toEpochSecond(ZoneOffset.UTC) - 
                  LocalDate.now().atStartOfDay().toEpochSecond(ZoneOffset.UTC)
        
        redisTemplate.opsForValue().increment(key)
        redisTemplate.expire(key, ttl, java.util.concurrent.TimeUnit.SECONDS)
    }
    
    suspend fun checkSearchTypeAllowed(userId: String, searchType: String): SubscriptionCheckResult {
        val userPlan = getUserPlan(userId)
        val limits = SubscriptionLimits.getLimits(userPlan)
        
        return if (searchType !in limits.allowedSearchTypes) {
            SubscriptionCheckResult(
                allowed = false,
                reason = "Search type not available in your plan",
                requiredPlan = SubscriptionPlan.PREMIUM
            )
        } else {
            SubscriptionCheckResult(allowed = true)
        }
    }
    
    private suspend fun getUserPlan(userId: String): SubscriptionPlan {
        val status = subscriptionService.getUserSubscriptionStatus(userId)
        return if (status.hasActiveSubscription && status.subscriptionTier == "premium") {
            SubscriptionPlan.PREMIUM
        } else {
            SubscriptionPlan.FREE
        }
    }
}

data class SubscriptionCheckResult(
    val allowed: Boolean,
    val reason: String? = null,
    val limit: Int? = null,
    val current: Int? = null,
    val requiredPlan: SubscriptionPlan? = null
)