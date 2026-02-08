"""
Matching Engine - Core algorithm for student-job matching
"""


class MatchingEngine:
    """
    Calculate compatibility between student skills and job requirements
    """

    def calculate_match(self, student_skills, job_required_skills, job_nice_to_have=None):
        """
        Calculate compatibility score between student and job

        Args:
            student_skills: List of skills extracted from resume
            job_required_skills: List of required skills for job
            job_nice_to_have: List of nice-to-have skills (optional)

        Returns:
            dict: {
                'score': float (0-100),
                'matched_required': list of matched required skills,
                'matched_nice_to_have': list of matched optional skills,
                'missing_required': list of missing required skills
            }
        """
        if not job_required_skills:
            return {
                'score': 0,
                'matched_required': [],
                'matched_nice_to_have': [],
                'missing_required': []
            }

        # Normalize skills to lowercase for comparison
        student_skills_set = set(skill.lower().strip() for skill in student_skills)
        required_skills_set = set(skill.lower().strip() for skill in job_required_skills)
        nice_to_have_set = set(skill.lower().strip() for skill in (job_nice_to_have or []))

        # Calculate matches
        matched_required = student_skills_set & required_skills_set
        missing_required = required_skills_set - student_skills_set

        # Required skills match (80% weight)
        required_match_ratio = len(matched_required) / len(required_skills_set)

        # Nice-to-have skills match (20% weight)
        if nice_to_have_set:
            matched_nice_to_have = student_skills_set & nice_to_have_set
            nice_to_have_ratio = len(matched_nice_to_have) / len(nice_to_have_set)
        else:
            matched_nice_to_have = set()
            nice_to_have_ratio = 0

        # Weighted score
        score = (required_match_ratio * 0.8) + (nice_to_have_ratio * 0.2)
        final_score = round(score * 100, 2)

        return {
            'score': final_score,
            'matched_required': sorted(list(matched_required)),
            'matched_nice_to_have': sorted(list(matched_nice_to_have)),
            'missing_required': sorted(list(missing_required))
        }

    def get_matches_for_resume(self, resume_id, jobs):
        """
        Get all job matches for a given resume

        Args:
            resume_id: ID of the resume
            jobs: Queryset or list of Job objects

        Returns:
            list: Sorted list of matches with score >= 50%
        """
        from models import Resume

        try:
            resume = Resume.objects.get(id=resume_id)
            student_skills = resume.parsed_data.get('skills', [])
        except Resume.DoesNotExist:
            return []

        matches = []
        for job in jobs:
            match_result = self.calculate_match(
                student_skills,
                job.required_skills,
                job.nice_to_have_skills
            )

            # Only include matches with score >= 50%
            if match_result['score'] >= 50:
                matches.append({
                    'job_id': job.id,
                    'job_title': job.title,
                    'company': job.company,
                    'location': job.location,
                    'description': job.description,
                    'compatibility_score': match_result['score'],
                    'matched_skills': match_result['matched_required'] + match_result['matched_nice_to_have'],
                    'missing_skills': match_result['missing_required']
                })

        # Sort by compatibility score (highest first)
        matches.sort(key=lambda x: x['compatibility_score'], reverse=True)
        return matches
