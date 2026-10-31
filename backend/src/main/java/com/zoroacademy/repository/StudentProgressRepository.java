package com.zoroacademy.repository;

import com.zoroacademy.entity.StudentProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentProgressRepository extends JpaRepository<StudentProgress, Long> {
    List<StudentProgress> findByStudentIdIgnoreCaseAndCourseId(String studentId, String courseId);
    Optional<StudentProgress> findByStudentIdIgnoreCaseAndCourseIdAndModuleId(String studentId, String courseId, String moduleId);
    List<StudentProgress> findByStudentIdIgnoreCase(String studentId);
    List<StudentProgress> findByCourseId(String courseId);
    void deleteByCourseId(String courseId);
}
