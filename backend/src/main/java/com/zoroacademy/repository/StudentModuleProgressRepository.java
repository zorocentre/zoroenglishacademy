package com.zoroacademy.repository;

import com.zoroacademy.entity.StudentModuleProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentModuleProgressRepository extends JpaRepository<StudentModuleProgress, String> {
    List<StudentModuleProgress> findByStudentId(String studentId);
    List<StudentModuleProgress> findByStudentIdAndCourseId(String studentId, String courseId);
    List<StudentModuleProgress> findByCourseId(String courseId);
    Optional<StudentModuleProgress> findByStudentIdAndModuleId(String studentId, String moduleId);
    void deleteByCourseId(String courseId);
}
