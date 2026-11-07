export function ResultView({
  success,
  prizeName,
}: {
  success: boolean;
  prizeName?: string;
}) {
  return (
    <main className={`controller-result ${success ? 'result-success' : 'result-empty'}`}>
      <section>
        <p className="controller-kicker">TURN RESULT</p>
        <div className="result-symbol" aria-hidden="true">{success ? '✦' : '◇'}</div>
        <h1>{success ? prizeName : '빈 캡슐이에요'}</h1>
        {success ? (
          <>
            <strong>축하합니다!</strong>
            <p>전시장 안내 데스크에서 이 화면을 보여주고<br />상품을 교환해 주세요.</p>
          </>
        ) : (
          <p>이번에는 집게가 비어 돌아왔어요.<br />다음 기회를 기다려 주세요.</p>
        )}
      </section>
    </main>
  );
}
