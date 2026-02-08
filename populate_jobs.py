"""
Populate database with sample jobs for demo
Run with: python populate_jobs.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
django.setup()

from models import Job

def populate_jobs():
    """Create sample job postings"""
    
    jobs_data = [
        {
            'title': 'Software Engineer Intern',
            'company': 'Tech Innovations Ltd',
            'description': 'Join our team to build cutting-edge web applications. You will work with experienced developers on real-world projects using modern frameworks.',
            'required_skills': ['python', 'javascript', 'git', 'sql'],
            'nice_to_have_skills': ['django', 'react', 'docker'],
            'location': 'Lagos, Nigeria'
        },
        {
            'title': 'Frontend Developer Intern',
            'company': 'Digital Solutions',
            'description': 'Create stunning user interfaces for our web applications. Work with React, TypeScript, and modern CSS frameworks.',
            'required_skills': ['html', 'css', 'javascript', 'react'],
            'nice_to_have_skills': ['typescript', 'tailwindcss', 'figma'],
            'location': 'Abuja, Nigeria'
        },
        {
            'title': 'Backend Developer Intern',
            'company': 'CloudBase Systems',
            'description': 'Build robust APIs and server-side applications. Learn about microservices, databases, and cloud deployment.',
            'required_skills': ['python', 'django', 'postgresql', 'rest api'],
            'nice_to_have_skills': ['docker', 'aws', 'redis'],
            'location': 'Port Harcourt, Nigeria'
        },
        {
            'title': 'Data Science Intern',
            'company': 'Analytics Pro',
            'description': 'Analyze data and build machine learning models. Work on real business problems using Python and popular ML libraries.',
            'required_skills': ['python', 'pandas', 'numpy', 'machine learning'],
            'nice_to_have_skills': ['tensorflow', 'jupyter', 'tableau'],
            'location': 'Lagos, Nigeria'
        },
        {
            'title': 'Full Stack Developer Intern',
            'company': 'StartUp Hub',
            'description': 'Work on both frontend and backend of our platform. Great opportunity to learn the full software development lifecycle.',
            'required_skills': ['javascript', 'react', 'node.js', 'mongodb'],
            'nice_to_have_skills': ['typescript', 'express', 'docker', 'aws'],
            'location': 'Remote (Nigeria)'
        },
        {
            'title': 'Mobile App Developer Intern',
            'company': 'MobileFirst Inc',
            'description': 'Develop cross-platform mobile applications using React Native. Learn mobile development best practices.',
            'required_skills': ['javascript', 'react', 'mobile development'],
            'nice_to_have_skills': ['react native', 'typescript', 'firebase'],
            'location': 'Ibadan, Nigeria'
        },
        {
            'title': 'DevOps Intern',
            'company': 'Infrastructure Co',
            'description': 'Learn about CI/CD pipelines, cloud infrastructure, and automation. Work with modern DevOps tools.',
            'required_skills': ['linux', 'git', 'bash', 'docker'],
            'nice_to_have_skills': ['kubernetes', 'aws', 'terraform', 'jenkins'],
            'location': 'Lagos, Nigeria'
        },
        {
            'title': 'UI/UX Design Intern',
            'company': 'Creative Studio',
            'description': 'Design beautiful and intuitive user interfaces. Work on user research, wireframing, and prototyping.',
            'required_skills': ['figma', 'design thinking', 'prototyping'],
            'nice_to_have_skills': ['html', 'css', 'user research'],
            'location': 'Abuja, Nigeria'
        }
    ]

    # Clear existing jobs
    Job.objects.all().delete()
    print("Cleared existing jobs")

    # Create new jobs
    created_count = 0
    for job_data in jobs_data:
        job = Job.objects.create(**job_data)
        created_count += 1
        print(f"Created: {job.title} at {job.company}")

    print(f"\n✅ Successfully created {created_count} sample jobs!")
    return created_count


if __name__ == '__main__':
    populate_jobs()
