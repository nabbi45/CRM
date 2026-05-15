const termKeys = ["term_1", "term_2", "term_3"];

const getTermShare = (booking, termKey) => {
  const termShare = booking?.term_shares?.[termKey];
  if (termShare?.creator?.user_id) return termShare;

  if (termKey === "term_1") {
    return {
      creator: {
        user_id: booking?.user_id,
        user_name: booking?.bdm,
      },
      payment_date: booking?.payment_date || booking?.date || booking?.createdAt,
      shared_with: Array.isArray(booking?.shared_with) ? booking.shared_with : [],
    };
  }

  return {
    creator: {
      user_id: booking?.user_id,
      user_name: booking?.bdm,
    },
    payment_date: booking?.payment_date || booking?.date || booking?.createdAt,
    shared_with: [],
  };
};

export const getBookingRevenueForUser = (booking, userId, isAdmin = false, includeTerm = () => true) => {
  return termKeys.reduce((sum, termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return sum;
    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return sum;
    if (isAdmin) return sum + amount;

    const sharedWith = Array.isArray(termShare.shared_with) ? termShare.shared_with : [];
    const sharedTotal = sharedWith.reduce((total, sw) => total + Number(sw.percentage || 0), 0);

    if (String(termShare.creator?.user_id || "") === String(userId || "")) {
      return sum + amount * ((100 - sharedTotal) / 100);
    }

    const sharedUser = sharedWith.find((sw) => String(sw.user_id) === String(userId || ""));
    if (sharedUser) return sum + amount * (Number(sharedUser.percentage || 0) / 100);

    return sum;
  }, 0);
};

export const addBookingRevenueToLeaderboard = (booking, board, usersMap = {}, includeTerm = () => true) => {
  termKeys.forEach((termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return;

    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return;
    const sharedWith = Array.isArray(termShare.shared_with) ? termShare.shared_with : [];
    let sharedTotalAmount = 0;

    sharedWith.forEach((sw) => {
      const percentage = Number(sw.percentage || 0);
      const sharedAmount = amount * (percentage / 100);
      sharedTotalAmount += sharedAmount;
      const name = sw.user_name || usersMap[sw.user_id] || "COWORKER";
      if (!board[name]) board[name] = { revenue: 0, count: 0 };
      board[name].revenue += sharedAmount;
      board[name].count += 1;
    });

    const creatorName = termShare.creator?.user_name || usersMap[termShare.creator?.user_id] || booking?.bdm || "UNKNOWN";
    if (!board[creatorName]) board[creatorName] = { revenue: 0, count: 0 };
    board[creatorName].revenue += amount - sharedTotalAmount;
    board[creatorName].count += 1;
  });
};
