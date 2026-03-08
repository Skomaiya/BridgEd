"""
Centralized and expanded skill synonyms for the BridgEd Matching Engine.
Maps alternate/abbreviated forms to canonical forms to improve matching efficiency.
"""

SKILL_SYNONYMS = {
    # Programming Languages & Stacks
    "js": "javascript",
    "javascript": "javascript",
    "ts": "typescript",
    "typescript": "typescript",
    "py": "python",
    "python": "python",
    "python3": "python",
    "python 3": "python",
    "golang": "go",
    "go lang": "go",
    "c#": "csharp",
    "c sharp": "csharp",
    "c++": "cpp",
    "c plus plus": "cpp",
    ".net": "dotnet",
    "dotnet core": "dotnet",
    
    # Frontend Frameworks & Tech
    "react.js": "react",
    "reactjs": "react",
    "react.js": "react",
    "vue.js": "vue",
    "vuejs": "vue",
    "angular.js": "angular",
    "angularjs": "angular",
    "html5": "html",
    "html": "html",
    "css3": "css",
    "css": "css",
    "sass": "scss",
    "tailwindcss": "tailwind",
    "tailwind css": "tailwind",
    
    # Backend Frameworks
    "node": "node.js",
    "nodejs": "node.js",
    "node js": "node.js",
    "express": "express.js",
    "expressjs": "express.js",
    "express js": "express.js",
    "dj": "django",
    "django": "django",
    "ror": "ruby on rails",
    "rails": "ruby on rails",
    
    # Cloud & DevOps
    "aws": "amazon web services",
    "amazon": "amazon web services",
    "gcp": "google cloud platform",
    "google cloud": "google cloud platform",
    "azure": "microsoft azure",
    "cloud computing": "cloud",
    "ci/cd": "cicd",
    "continuous integration": "cicd",
    "continuous deployment": "cicd",
    "docker": "docker",
    "k8s": "kubernetes",
    "kube": "kubernetes",
    "containerization": "docker",
    
    # Databases
    "postgres": "postgresql",
    "postgre": "postgresql",
    "sql": "sql",
    "mysql": "mysql",
    "mongo": "mongodb",
    "nosql": "nosql",
    "redis": "redis",
    
    # Mobile
    "rn": "react native",
    "flutter": "flutter",
    "android": "android",
    "ios": "ios",
    "kotlin": "kotlin",
    "swift": "swift",
    
    # AI/ML/Data
    "ml": "machine learning",
    "machine learning": "ml",
    "ai": "artificial intelligence",
    "artificial intelligence": "ai",
    "data science": "data analytics",
    "data analytics": "data science",
    "nlp": "natural language processing",
    "natural language processing": "nlp",
    "cv": "computer vision",
    "computer vision": "cv",
    "dl": "deep learning",
    "deep learning": "dl",
    
    # Others/General
    "it": "information technology",
    "ict": "information technology",
    "ui": "user interface",
    "ux": "user experience",
    "ui/ux": "ui ux",
    "rest api": "rest",
    "restful": "rest",
    "restful api": "rest",
    "git": "git",
    "github": "git",
}
