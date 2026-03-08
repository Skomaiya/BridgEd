"""
Skill Keywords Database for Resume Parsing

This module provides a comprehensive, categorized database of technical and
soft skills commonly found in resumes. It serves as the knowledge base for
the NLP parser's skill extraction functionality.

The skill keywords are organized by category to facilitate:
- Structured skill matching
- Category-based filtering
- Analytics and reporting
"""

from typing import List, Dict


# ============ SKILL KEYWORDS DATABASE ============

SKILL_KEYWORDS: Dict[str, List[str]] = {
    # Programming Languages
    # Common languages used in software development
    'programming': [
        'python', 'javascript', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust',
        'typescript', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'html', 'css',
        'perl', 'haskell', 'lua', 'dart', 'elixir', 'clojure', 'objective-c',
        'visual basic', 'assembly', 'fortran', 'cobol', 'sql', 'pl/sql'
    ],
    
    # Web & Mobile Frameworks
    # Frameworks for building web and mobile applications
    'frameworks': [
        'react', 'angular', 'vue', 'django', 'flask', 'fastapi', 'express',
        'spring', 'spring boot', 'laravel', 'rails', 'asp.net', 'next.js', 
        'nuxt', 'svelte', 'ember', 'backbone', 'meteor', 'gatsby', 'quasar',
        'blazor', 'phoenix', 'play', 'tornado', 'pyramid', 'bottle'
    ],
    
    # Databases & Data Storage
    # Database systems and data storage technologies
    'databases': [
        'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'oracle',
        'sql server', 'cassandra', 'dynamodb', 'elasticsearch', 'sql',
        'mariadb', 'couchdb', 'neo4j', 'influxdb', 'firebase', 'supabase',
        'cockroachdb', 'timescaledb', 'memcached', 'etcd', 'rethinkdb'
    ],
    
    # DevOps & Cloud Tools
    # Tools for deployment, cloud services, and infrastructure
    'tools': [
        'git', 'github', 'gitlab', 'docker', 'kubernetes', 'jenkins',
        'aws', 'azure', 'gcp', 'terraform', 'ansible', 'linux', 'bash',
        'nginx', 'apache', 'jira', 'postman', 'figma', 'sketch',
        'bitbucket', 'travis ci', 'circle ci', 'vagrant', 'webpack',
        'gradle', 'maven', 'npm', 'yarn', 'prometheus', 'grafana',
        'datadog', 'splunk', 'elk stack', 'nagios', 'puppet', 'chef'
    ],
    
    # Data Science & Machine Learning
    # ML/AI frameworks and data science tools
    'data_science': [
        'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras',
        'scikit-learn', 'pandas', 'numpy', 'jupyter', 'tableau', 'power bi',
        'spark', 'hadoop', 'airflow', 'mlflow', 'nlp', 'computer vision',
        'opencv', 'spacy', 'nltk', 'transformers', 'langchain', 'mxnet',
        'caffe', 'xgboost', 'lightgbm', 'statsmodels', 'plotly', 'seaborn',
        'matplotlib', 'dask', 'rapids', 'wandb', 'tensorboard'
    ],
    
    # Soft Skills
    # Non-technical skills and competencies
    'soft_skills': [
        'leadership', 'communication', 'teamwork', 'problem solving',
        'critical thinking', 'time management', 'project management',
        'agile', 'scrum', 'collaboration', 'presentation', 'mentoring',
        'conflict resolution', 'adaptability', 'creativity', 'innovation',
        'customer service', 'negotiation', 'strategic thinking', 'decision making',
        'emotional intelligence', 'public speaking', 'cross-functional collaboration'
    ],
    
    # Testing & Quality Assurance
    # Testing frameworks and methodologies
    'testing': [
        'unit testing', 'integration testing', 'pytest', 'jest', 'mocha',
        'selenium', 'cypress', 'junit', 'testng', 'tdd', 'bdd',
        'cucumber', 'jasmine', 'chai', 'phpunit', 'rspec', 'karma',
        'playwright', 'webdriver', 'appium', 'postman', 'soapui',
        'jmeter', 'locust', 'k6', 'test automation', 'qa'
    ],
    
    # Mobile Development
    # Mobile app development frameworks and platforms
    'mobile': [
        'react native', 'flutter', 'ionic', 'xamarin', 'android',
        'ios', 'swift ui', 'mobile development', 'kotlin multiplatform',
        'cordova', 'capacitor', 'nativescript', 'expo', 'firebase',
        'android studio', 'xcode', 'jetpack compose'
    ],
    
    # Security & Cybersecurity
    # Security tools, practices, and certifications
    'security': [
        'cybersecurity', 'penetration testing', 'ethical hacking', 'owasp',
        'ssl', 'tls', 'encryption', 'oauth', 'jwt', 'saml', 'ldap',
        'firewall', 'vpn', 'intrusion detection', 'vulnerability assessment',
        'security audit', 'cissp', 'ceh', 'oscp', 'siem', 'soc'
    ],
    
    # Blockchain & Web3
    # Blockchain technologies and cryptocurrency
    'blockchain': [
        'blockchain', 'ethereum', 'solidity', 'smart contracts', 'web3',
        'defi', 'nft', 'cryptocurrency', 'bitcoin', 'hyperledger',
        'truffle', 'hardhat', 'ganache', 'metamask', 'ipfs'
    ],
    
    # Design & UX
    # Design tools and methodologies
    'design': [
        'ui design', 'ux design', 'user experience', 'user interface',
        'wireframing', 'prototyping', 'adobe xd', 'figma', 'sketch',
        'invision', 'zeplin', 'photoshop', 'illustrator', 'design thinking',
        'user research', 'usability testing', 'information architecture'
    ],
}


# ============ UTILITY FUNCTIONS ============

def get_all_skills() -> List[str]:
    """
    Get a flat list of all skills across all categories.
    
    Returns:
        List of all skill keywords (sorted alphabetically)
    """
    all_skills = []
    for category, skills in SKILL_KEYWORDS.items():
        all_skills.extend(skills)
    
    # Return sorted list with duplicates removed
    return sorted(list(set(all_skills)))


def get_skills_by_category(category: str) -> List[str]:
    """
    Get all skills for a specific category.
    
    Args:
        category: The category name (e.g., 'programming', 'frameworks')
        
    Returns:
        List of skills in that category, or empty list if category not found
    """
    return SKILL_KEYWORDS.get(category, [])


def get_all_categories() -> List[str]:
    """
    Get a list of all skill categories.
    
    Returns:
        List of category names
    """
    return list(SKILL_KEYWORDS.keys())


def search_skills(query: str) -> List[str]:
    """
    Search for skills matching a query string.
    
    Performs case-insensitive substring matching.
    
    Args:
        query: Search string
        
    Returns:
        List of skills containing the query string
    """
    query_lower = query.lower()
    all_skills = get_all_skills()
    return [skill for skill in all_skills if query_lower in skill]


def get_skill_count() -> int:
    """
    Get the total number of unique skills in the database.
    
    Returns:
        Total count of unique skills
    """
    return len(get_all_skills())


def get_category_info() -> Dict[str, int]:
    """
    Get information about each category (name and skill count).
    
    Returns:
        Dictionary mapping category names to skill counts
    """
    return {
        category: len(skills)
        for category, skills in SKILL_KEYWORDS.items()
    }

