plugins {
	kotlin("jvm") version "2.1.21"
	kotlin("plugin.spring") version "1.9.25"
	id("org.springframework.boot") version "3.5.0"
	id("io.spring.dependency-management") version "1.1.7"
}


group = "staffbase"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {

	testImplementation(platform("org.junit:junit-bom:5.13.1"))
	testImplementation("org.junit.jupiter:junit-jupiter")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")

	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	developmentOnly("org.springframework.boot:spring-boot-devtools")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")

	implementation("org.springframework.boot:spring-boot-starter-data-mongodb")
	implementation(platform("org.mongodb:mongodb-driver-bom:5.5.1"))
	implementation("org.mongodb:mongodb-driver-kotlin-coroutine")
	implementation("org.mongodb:bson-kotlinx")
	
	implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")


	implementation("jakarta.validation:jakarta.validation-api:3.0.2")
	implementation("org.hibernate.validator:hibernate-validator:8.0.0.Final")

	implementation("com.auth0:java-jwt:4.5.0")

	implementation("com.google.api-client:google-api-client:2.8.0")
	implementation("com.google.oauth-client:google-oauth-client:1.39.0")
	implementation("com.google.api-client:google-api-client:2.4.1")
	implementation("com.google.http-client:google-http-client-gson:1.43.3")

	implementation("org.apache.pdfbox:pdfbox:2.0.29")

	implementation("software.amazon.awssdk:s3:2.25.2")
	implementation("software.amazon.awssdk:auth:2.25.2")
	implementation("software.amazon.awssdk:regions:2.25.2")

	implementation("org.springframework.boot:spring-boot-starter-data-redis")
	implementation("com.fasterxml.jackson.module:jackson-module-kotlin")

	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.2.0")

	implementation("org.springframework.boot:spring-boot-starter-security")

	testImplementation("org.springframework.boot:spring-boot-starter-test") {
		exclude(module = "mockito-core")
	}

	testImplementation("io.mockk:mockk:1.14.2")
	testImplementation("com.ninja-squad:springmockk:4.0.2")
}

kotlin {
	compilerOptions {
		freeCompilerArgs.addAll("-Xjsr305=strict")
	}
}

tasks {
	"wrapper"(Wrapper::class) {
		gradleVersion = "8.5"
	}

	withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
		kotlinOptions {
			freeCompilerArgs = listOf(
				"-Xjsr305=strict"
			)
			jvmTarget = "21"
		}
	}
	withType<Test> {
		useJUnitPlatform()
	}
}
