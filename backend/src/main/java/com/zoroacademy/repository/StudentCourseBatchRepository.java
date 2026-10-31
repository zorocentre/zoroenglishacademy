package com.zoroacademy.repository;

import com.zoroacademy.entity.StudentCourseBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentCourseBatchRepository extends JpaRepository<StudentCourseBatch, Long> {
    List<StudentCourseBatch> findByStudentId(String studentId);
    List<StudentCourseBatch> findByBatchId(String batchId);
    List<StudentCourseBatch> findByCourseId(String courseId);
    java.util.Optional<StudentCourseBatch> findByStudentIdAndCourseId(String studentId, String courseId);
    void deleteByStudentId(String studentId);
    void deleteByCourseId(String courseId);
    long countByBatchId(String batchId);
}
