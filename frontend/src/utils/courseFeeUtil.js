export function formatPublicCourseFee(course, fallback = 'Free') {
  if (!course) return fallback;
  const numPrice = course.price != null ? Number(course.price) : 0;
  if (!numPrice || isNaN(numPrice) || numPrice <= 0) {
    return fallback;
  }
  const unit = (course.durationUnit || (course.duration ? course.duration.split(' ')[1] : '') || '').toLowerCase();
  if (unit.startsWith('month') || unit.startsWith('year')) {
    const entered = course.enteredFee != null ? Number(course.enteredFee) : numPrice;
    return `₹${entered.toLocaleString('en-IN')} /month`;
  }
  // Hours, Days or other
  const displayAmount = course.enteredFee != null && (unit.startsWith('hour') || unit.startsWith('day'))
    ? Number(course.enteredFee)
    : numPrice;
  return `₹${displayAmount.toLocaleString('en-IN')}`;
}
