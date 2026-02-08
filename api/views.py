"""
API Views for BridgEd Platform
Includes authentication, CRUD operations, and custom endpoints
"""
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .models import Student, Employer, Resume, Job, Match, Subscription, Invoice, Notification
from .serializers import (
    UserSerializer, UserRegistrationSerializer, StudentSerializer,
    EmployerSerializer, ResumeSerializer, JobSerializer, JobListSerializer,
    MatchSerializer, MatchListSerializer, SubscriptionSerializer,
    InvoiceSerializer, NotificationSerializer, LoginSerializer,
    LogoutSerializer, AuthResponseSerializer, FileUploadSerializer
)
from .permissions import (
    IsStudent, IsEmployer, IsAdmin, IsOwnProfile,
    CanViewStudentProfile, CanViewMatch, IsJobOwner
)

User = get_user_model()


# ============ AUTHENTICATION VIEWS ============

class RegisterView(APIView):
    """
    User registration endpoint
    POST /api/auth/register
    Body: {email, password, password_confirm, role}
    """
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=UserRegistrationSerializer,
        responses={
            201: AuthResponseSerializer,
            400: OpenApiResponse(description="Validation errors")
        },
        description="Register a new user account (student or employer)",
        tags=["Authentication"]
    )
    @transaction.atomic
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Create corresponding profile based on role
            if user.role == 'student':
                Student.objects.create(user=user)
            elif user.role == 'employer':
                # Employer profile created with company details
                company_name = request.data.get('company_name', 'Company Name Required')
                Employer.objects.create(user=user, company_name=company_name)
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    User login endpoint
    POST /api/auth/login
    Body: {email, password}
    """
    permission_classes = [AllowAny]
    
    @extend_schema(
        request=LoginSerializer,
        responses={
            200: AuthResponseSerializer,
            400: OpenApiResponse(description="Missing credentials"),
            401: OpenApiResponse(description="Invalid credentials"),
            403: OpenApiResponse(description="Account inactive")
        },
        description="Authenticate user and receive JWT tokens",
        tags=["Authentication"]
    )
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response(
                {'error': 'Email and password required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticate(email=email, password=password)
        
        if user is None:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.is_active:
            return Response(
                {'error': 'Account is inactive'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })


class LogoutView(APIView):
    """
    User logout endpoint
    POST /api/auth/logout
    Body: {refresh_token}
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        request=LogoutSerializer,
        responses={
            200: OpenApiResponse(description="Logout successful"),
            400: OpenApiResponse(description="Invalid token")
        },
        description="Logout user by blacklisting refresh token",
        tags=["Authentication"]
    )
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logout successful'})
        except Exception:
            return Response(
                {'error': 'Invalid token'},
                status=status.HTTP_400_BAD_REQUEST
            )


# ============ PROFILE VIEWS ============

class StudentProfileView(generics.RetrieveUpdateAPIView):
    """
    Student profile management
    GET/PUT /api/students/profile
    """
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated, IsStudent]
    
    def get_object(self):
        return self.request.user.student_profile


class EmployerProfileView(generics.RetrieveUpdateAPIView):
    """
    Employer profile management
    GET/PUT /api/employers/profile
    """
    serializer_class = EmployerSerializer
    permission_classes = [IsAuthenticated, IsEmployer]
    
    def get_object(self):
        return self.request.user.employer_profile


# ============ RESUME VIEWS ============

class ResumeUploadView(APIView):
    """
    Resume upload and parsing
    POST /api/resumes/upload
    """
    permission_classes = [IsAuthenticated, IsStudent]
    
    @extend_schema(
        request=FileUploadSerializer,
        responses={
            201: ResumeSerializer,
            400: OpenApiResponse(description="No file provided"),
            500: OpenApiResponse(description="Parsing error")
        },
        description="Upload and parse a student resume (PDF format)",
        tags=["Resumes"]
    )
    @transaction.atomic
    def post(self, request):
        file = request.FILES.get  ('file')
        
        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            student = request.user.student_profile
            
            # Delete old resume if exists
            if hasattr(student, 'resume'):
                student.resume.delete()
            
            # Create new resume
            resume = Resume.objects.create(
                student=student,
                file=file
            )
            
            # Parse resume (import dynamically to avoid circular import)
            from services.resume_pipeline import ResumeParsingPipeline
            pipeline = ResumeParsingPipeline()
            parsed_data = pipeline.run(resume.file.path)
            
            resume.parsed_data = parsed_data
            resume.parsing_accuracy = parsed_data.get('confidence', 0.0)
            resume.save()
            
            return Response(
                ResumeSerializer(resume).data,
                status=status.HTTP_201_CREATED
            )
        
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ResumeDetailView(generics.RetrieveAPIView):
    """
    Get resume details
    GET /api/resumes/<resume_id>
    """
    serializer_class = ResumeSerializer
    permission_classes = [IsAuthenticated, IsOwnProfile]
    queryset = Resume.objects.all()
    lookup_field = 'resume_id'


# ============ JOB VIEWS ============

class JobViewSet(viewsets.ModelViewSet):
    """
    Job CRUD operations
    GET /api/jobs - List all open jobs
    POST /api/jobs - Create job (employers only)
    GET /api/jobs/<id> - Get job details
    PUT/PATCH /api/jobs/<id> - Update job
    DELETE /api/jobs/<id> - Delete job
    """
    queryset = Job.objects.filter(is_open=True)
    lookup_field = 'job_id'
    
    def get_serializer_class(self):
        if self.action == 'list':
            return JobListSerializer
        return JobSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsEmployer()]
        return [IsAuthenticated()]
    
    def perform_create(self, serializer):
        """Auto-assign employer when creating job"""
        employer = self.request.user.employer_profile
        serializer.save(employer=employer)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsEmployer])
    def my_jobs(self, request):
        """Get jobs posted by current employer"""
        jobs = Job.objects.filter(employer__user=request.user)
        serializer = JobListSerializer(jobs, many=True)
        return Response(serializer.data)


# ============ MATCHING VIEWS ============

class MatchView(APIView):
    """
    Get matches for student
    POST /api/match
    Body: {} (uses authenticated user)
    """
    permission_classes = [IsAuthenticated, IsStudent]
    
    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(
                description="List of job matches with compatibility scores",
                response={
                    'type': 'object',
                    'properties': {
                        'student_id': {'type': 'string', 'format': 'uuid'},
                        'total_matches': {'type': 'integer'},
                        'matches': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'match_id': {'type': 'string', 'format': 'uuid'},
                                    'job_id': {'type': 'string', 'format': 'uuid'},
                                    'job_title': {'type': 'string'},
                                    'company': {'type': 'string'},
                                    'location': {'type': 'string'},
                                    'compatibility_score': {'type': 'number'},
                                    'matched_skills': {'type': 'array', 'items': {'type': 'string'}},
                                    'missing_skills': {'type': 'array', 'items': {'type': 'string'}}
                                }
                            }
                        }
                    }
                }
            ),
            400: OpenApiResponse(description="Resume required"),
            500: OpenApiResponse(description="Matching error")
        },
        description="Calculate job matches for authenticated student based on their resume",
        tags=["Matching"]
    )
    def post(self, request):
        try:
            student = request.user.student_profile
            
            # Get student's resume
            if not hasattr(student, 'resume'):
                return Response(
                    {'error': 'Please upload a resume first'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            resume = student.resume
            student_skills = resume.parsed_data.get('skills', [])
            
            # Get all open jobs
            jobs = Job.objects.filter(is_open=True)
            
            # Calculate matches
            from services.matching_engine import MatchingEngine
            engine = MatchingEngine()
            matches_data = []
            
            for job in jobs:
                match_result = engine.calculate_match(
                    student_skills,
                    job.required_skills,
                    job.nice_to_have_skills
                )
                
                if match_result['score'] >= 50:  # Minimum threshold
                    # Create or update match
                    match, created = Match.objects.update_or_create(
                        student=student,
                        job=job,
                        defaults={'compatibility_score': match_result['score']}
                    )
                    
                    matches_data.append({
                        'match_id': str(match.match_id),
                        'job_id': str(job.job_id),
                        'job_title': job.title,
                        'company': job.employer.company_name,
                        'location': job.location,
                        'compatibility_score': match_result['score'],
                        'matched_skills': match_result['matched_required'] + match_result['matched_nice_to_have'],
                        'missing_skills': match_result['missing_required']
                    })
            
            # Sort by compatibility score
            matches_data.sort(key=lambda x: x['compatibility_score'], reverse=True)
            
            return Response({
                'student_id': str(student.student_id),
                'total_matches': len(matches_data),
                'matches': matches_data
            })
        
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class IndicateInterestView(APIView):
    """
    Student indicates interest in a match
    POST /api/matches/<match_id>/interest
    """
    permission_classes = [IsAuthenticated, IsStudent]
    
    @extend_schema(
        request=None,
        responses={
            200: MatchListSerializer,
            404: OpenApiResponse(description="Match not found")
        },
        description="Student indicates interest in a specific job match",
        tags=["Matching"]
    )
    def post(self, request, match_id):
        try:
            match = Match.objects.get(
                match_id=match_id,
                student__user=request.user
            )
            match.student_interested = True
            match.save()
            
            # Create notification for employer
            Notification.objects.create(
                user=match.job.employer.user,
                type='student_interested',
                message=f"A student has indicated interest in your job: {match.job.title}"
            )
            
            return Response({
                'message': 'Interest indicated successfully',
                'match': MatchListSerializer(match).data
            })
        except Match.DoesNotExist:
            return Response(
                {'error': 'Match not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class EmployerMatchesView(generics.ListAPIView):
    """
    Get matches for employer's jobs (students who indicated interest)
    GET /api/employer/matches
    """
    serializer_class = MatchSerializer
    permission_classes = [IsAuthenticated, IsEmployer]
    
    def get_queryset(self):
        return Match.objects.filter(
            job__employer__user=self.request.user,
            student_interested=True
        )


# ============ NOTIFICATION VIEWS ============

class NotificationListView(generics.ListAPIView):
    """
    Get user notifications
    GET /api/notifications
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class MarkNotificationReadView(APIView):
    """
    Mark notification as read
    POST /api/notifications/<notification_id>/read
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(description="Notification marked as read"),
            404: OpenApiResponse(description="Notification not found")
        },
        description="Mark a specific notification as read",
        tags=["Notifications"]
    )
    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(
                notification_id=notification_id,
                user=request.user
            )
            notification.is_read = True
            notification.save()
            return Response({'message': 'Notification marked as read'})
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
