# LecturaLM - AI-Powered Learning Management Platform

> An intelligent learning platform that transforms PDF course materials into interactive, AI-enhanced study experiences with RAG-powered Q&A and web search capabilities.

## 🎯 Overview

LecturaLM is a full-stack AI learning platform designed to revolutionize how students interact with course materials. Upload PDFs, engage with an intelligent AI tutor powered by Google Gemini, and get context-aware answers from both your course materials and the web.

### Key Features

- 📚 **Smart PDF Processing** - Upload and automatically chunk course materials with intelligent semantic segmentation
- 🤖 **AI Chat Assistant** - Interactive Q&A with Google Gemini 2.0 Flash that understands your course context
- 🔍 **Hybrid Search** - RAG (Retrieval-Augmented Generation) with vector similarity search + web search via Tavily
- 📊 **Course Management** - Organize multiple courses with granular slide-level tracking
- 💬 **Conversation History** - Persistent chat history with MongoDB storage
- 🔐 **Google OAuth** - Secure authentication with Google Sign-In
- 💳 **Subscription Management** - Stripe integration for premium features
- 🎨 **Modern UI** - Beautiful, responsive React interface built with TypeScript and Tailwind CSS

## 🏗️ Architecture

LecturaLM uses a microservices architecture with three main components:

```
lectura-app/
├── frontend/          # React + TypeScript + Vite
├── backend/lectura/   # Kotlin + Spring Boot
└── ai_service/        # Python + FastAPI + LangChain
```

### Tech Stack

#### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Typography plugin
- **State Management**: Zustand + TanStack Query
- **PDF Viewer**: @react-pdf-viewer suite
- **Markdown**: react-markdown with KaTeX for math rendering
- **Auth**: @react-oauth/google

#### Backend (Spring Boot)
- **Language**: Kotlin 2.1
- **Framework**: Spring Boot 3.5
- **Database**: MongoDB (with Kotlin coroutines driver)
- **Cache**: Redis/Upstash
- **Authentication**: JWT + Google OAuth
- **Storage**: AWS S3
- **Payments**: Stripe
- **Security**: Spring Security with custom filters

#### AI Services (FastAPI)
- **Framework**: FastAPI + Uvicorn
- **LLM**: Google Gemini 2.0 Flash via LangChain
- **Agent Framework**: LangGraph for intelligent routing
- **Embeddings**: Voyage AI (multilingual support)
- **PDF Processing**: PyMuPDF + pymupdf4llm
- **Vector Store**: MongoDB with semantic search
- **Web Search**: Tavily API
- **Cache**: Upstash Redis

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Java** 21+ (for Kotlin/Spring Boot)
- **MongoDB** instance (or MongoDB Atlas)
- **Redis** instance (or Upstash Redis)
- **AWS** account with S3 bucket
- **API Keys**:
  - Google Cloud (OAuth + Gemini API)
  - Voyage AI (embeddings)
  - Tavily (web search)
  - Stripe (payments)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/tomasgpastore/lectura-app.git
cd lectura-app
```

#### 2. Frontend Setup

```bash
cd frontend
npm install

# Create .env file
cat > .env << EOF
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_API_BASE_URL=http://localhost:8080
EOF

# Start development server
npm run dev
```

#### 3. Backend Setup (Spring Boot)

```bash
cd backend/lectura

# Create .env file
cat > .env << EOF
MONGO_URI=mongodb://localhost:27017/lectura
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=your_google_client_id_here
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_s3_bucket
REDIS_HOST=localhost
REDIS_PORT=6379
STRIPE_API_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
EOF

# Build and run
./gradlew bootRun
```

#### 4. AI Services Setup (Python/FastAPI)

```bash
cd ai_service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URI=mongodb://localhost:27017/lectura
GOOGLE_API_KEY=your_gemini_api_key
VOYAGE_API_KEY=your_voyage_api_key
TAVILY_API_KEY=your_tavily_api_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_s3_bucket
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
EOF

# Run the service
python main.py
```

## 📡 API Overview

### AI Services (Port 8000)

#### Inbound Pipeline
```http
POST /inbound
Content-Type: application/json

{
  "course_id": "course_123",
  "slide_id": "slide_456",
  "s3_file_name": "lectures/week1.pdf"
}
```

Processes PDF from S3, chunks content, generates embeddings, and stores in MongoDB.

#### Outbound Pipeline (Chat)
```http
POST /outbound
Content-Type: application/json

{
  "user_id": "user_123",
  "course_id": "course_123",
  "user_prompt": "Explain quantum entanglement",
  "search_type": "RAG_WEB",
  "slide_priority": ["slide_456"],
  "snapshot": {
    "slide_id": "slide_456",
    "page_number": 5,
    "s3key": "lectures/week1.pdf"
  }
}
```

Intelligent agent routes queries through:
- **DEFAULT**: Direct LLM response
- **RAG**: Vector search in course materials
- **WEB**: Internet search for current info
- **RAG_WEB**: Combined search for comprehensive answers

#### Management
```http
DELETE /management
Content-Type: application/json

{
  "course_id": "course_123",
  "slide_id": "slide_456",
  "s3_file_name": "lectures/week1.pdf"
}
```

Deletes vectors/chunks when slides are removed.

### Backend API (Port 8080)

- **Auth**: `/api/auth/google` - Google OAuth login
- **Courses**: `/api/courses` - CRUD operations
- **Slides**: `/api/courses/{id}/slides` - PDF upload & management
- **AI Chat**: `/api/ai/query` - Proxies to AI services
- **Conversations**: `/api/conversations` - Chat history
- **Subscriptions**: `/api/subscriptions` - Stripe integration

## 🧠 How It Works

### 1. PDF Upload Flow
```
User uploads PDF → Backend saves to S3 → Triggers AI service
→ AI chunks PDF with PyMuPDF → Voyage AI generates embeddings
→ Stores vectors in MongoDB with metadata (course_id, slide_id, page)
```

### 2. Chat Query Flow
```
User asks question → Backend receives query → Forwards to AI service
→ LangGraph agent analyzes query → Routes to appropriate tool:
   ├─ RAG: MongoDB vector similarity search
   ├─ WEB: Tavily web search
   └─ RAG_WEB: Both sources combined
→ Google Gemini generates context-aware response
→ Returns answer with citations (RAG sources + web sources)
```

### 3. Intelligent Agent (LangGraph)

The AI service uses a stateful agent that:
- **Analyzes** user intent and available context
- **Decides** which search strategy to use
- **Retrieves** relevant information from multiple sources
- **Synthesizes** comprehensive answers with source attribution
- **Maintains** conversation context across messages

## 🎨 UI Features

- **Dashboard**: Course grid with real-time stats
- **PDF Viewer**: Synchronized scrolling, zoom, page navigation
- **Chat Interface**:
  - Markdown rendering with syntax highlighting
  - LaTeX math support (KaTeX)
  - Source citations with page references
  - Conversation snapshots (context from specific pages)
- **Responsive Design**: Mobile-friendly layout

## 🔒 Security

- ✅ Environment variables for all secrets
- ✅ JWT-based authentication with HTTP-only cookies
- ✅ Google OAuth 2.0 integration
- ✅ Spring Security with CORS configuration
- ��� Input validation with Pydantic (Python) and Jakarta Validation (Kotlin)
- ✅ No API keys committed to version control

## 🚧 Development

### Project Structure

```
lectura-app/
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Route-level pages
│   │   ├── contexts/       # React Context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # API clients, utilities
│   │   ├── stores/         # Zustand state stores
│   │   └── types/          # TypeScript definitions
│   ├── package.json
│   └── vite.config.ts
│
├── backend/lectura/
│   ├── src/main/kotlin/staffbase/lectura/
│   │   ├── auth/           # JWT + Google OAuth
│   │   ├── course/         # Course service & repo
│   │   ├── slide/          # PDF slide management
│   │   ├── user/           # User service
│   │   ├── ai/             # AI service integration
│   │   ├── subscription/   # Stripe integration
│   │   ├── config/         # Spring configuration
│   │   └── filter/         # Security filters
│   └── build.gradle.kts
│
└── ai_service/
    ├── app/
    │   ├── pipeline/
    │   │   ├── inbound/    # PDF processing
    │   │   ├── outbound/   # Chat agent
    │   │   └── manager/    # Vector management
    │   ├── config.py       # Environment config
    │   └── controller.py   # FastAPI routes
    ├── requirements.txt
    └── main.py
```

### Testing

```bash
# Frontend
cd frontend
npm run lint

# Backend
cd backend/lectura
./gradlew test

# AI Services
cd ai_service
pytest tests/
```

## 📊 Performance Optimizations

- **Frontend**: React Query caching, virtual scrolling for large documents
- **Backend**: Redis caching for user sessions and frequent queries
- **AI Services**: Batch embedding generation, connection pooling, async processing
- **Database**: Indexed fields for vector similarity search, compound indexes

## 🎓 Use Cases

- **Students**: Upload lecture slides, get instant answers with citations
- **Educators**: Provide AI-enhanced study materials
- **Researchers**: Query multiple papers with combined document + web search
- **Self-learners**: Transform any PDF content into an interactive learning experience

## 🛣️ Roadmap

- [ ] Multi-modal support (images, videos)
- [ ] Collaborative study rooms
- [ ] Advanced analytics (study patterns, knowledge gaps)
- [ ] Mobile app (React Native)
- [ ] Offline mode with local embeddings
- [ ] Support for additional LLMs (Claude, GPT-4)

## 📝 License

**Proprietary and Confidential**

Copyright (c) 2025 Tomas Godoy Pastore

All rights reserved. This software and associated documentation files (the "Software") are the exclusive property of Tomas Godoy Pastore. Unauthorized copying, modification, distribution, or use of this Software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

See [LICENSE](LICENSE) for full details.

## 👤 Author

**Tomas Godoy Pastore**

- GitHub: [@tomasgpastore](https://github.com/tomasgpastore)
- LinkedIn: [linkedin.com/in/tomasgodoypastore](https://www.linkedin.com/in/tomasgodoypastore)

## 🙏 Acknowledgments

- Google Gemini for powerful LLM capabilities
- Voyage AI for multilingual embeddings
- LangChain/LangGraph for agent framework
- React PDF Viewer for excellent PDF rendering
- All open-source contributors

---

**Note**: This is a portfolio project demonstrating full-stack development with modern AI/ML technologies. For inquiries or collaboration opportunities, please reach out via LinkedIn or GitHub.
