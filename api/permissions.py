"""
Custom permissions for role-based access control (RBAC)
"""
from rest_framework import permissions


class IsStudent(permissions.BasePermission):
    """Permission check: User is a student"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'student'


class IsEmployer(permissions.BasePermission):
    """Permission check: User is an employer"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'employer'


class IsAdmin(permissions.BasePermission):
    """Permission check: User is an admin"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission: Only owner can modify
    Others can read if permission allows
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions for safe methods
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only for owner
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return obj == request.user


class IsOwnProfile(permissions.BasePermission):
    """User can only access their own profile"""
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False


class CanViewStudentProfile(permissions.BasePermission):
    """
    Employer can only view student profile if:
    - Student indicated interest in employer's job
    - Following README security requirements
    """
    def has_object_permission(self, request, view, obj):
        # Students can view their own profile
        if request.user.role == 'student':
            return obj.user == request.user
        
        # Admins can view all
        if request.user.role == 'admin':
            return True
        
        # Employers can only view if student indicated interest
        if request.user.role == 'employer':
            from .models import Match
            return Match.objects.filter(
                student=obj,
                job__employer__user=request.user,
                student_interested=True
            ).exists()
        
        return False


class CanViewMatch(permissions.BasePermission):
    """
    Permission to view matches:
    - Students can view their own matches
    - Employers can view matches for their jobs
    - Admins can view all
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        
        if request.user.role == 'student':
            return obj.student.user == request.user
        
        if request.user.role == 'employer':
            return obj.job.employer.user == request.user
        
        return False


class IsJobOwner(permissions.BasePermission):
    """Only job owner (employer) can modify job"""
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.employer.user == request.user
