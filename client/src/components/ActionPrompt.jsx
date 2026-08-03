export const ACTION = {
  MAFIA_KILL: 'MAFIA_KILL',
  DOCTOR_SAVE: 'DOCTOR_SAVE',
  POLICE_CHECK: 'POLICE_CHECK',
  SPY_CONTACT: 'SPY_CONTACT',
};

/**
 * 지금 내가 할 수 있는 밤 행동. 없으면 null.
 * 대상은 명단에서 직접 고른다 — 여기서 목록을 또 그리지 않는다.
 *
 * 화면에서 못 고르게 막는 것은 편의일 뿐이고, 진짜 방어선은 서버다.
 */
export function nightActionFor(view) {
  const me = view.me;
  if (!me || !me.alive || view.phase !== 'NIGHT') return null;

  const alive = view.players.filter((p) => p.alive);
  const others = alive.filter((p) => p.id !== me.id).map((p) => p.id);

  switch (me.role) {
    case 'MAFIA':
      return {
        type: ACTION.MAFIA_KILL,
        prompt: '오늘 밤 누구를 제거할까요?',
        // 동료는 고를 수 없다.
        selectableIds: others.filter((id) => !(me.teammates ?? []).includes(id)),
      };
    case 'DOCTOR':
      return {
        type: ACTION.DOCTOR_SAVE,
        prompt: '오늘 밤 누구를 지킬까요? 자기 자신도 고를 수 있습니다.',
        selectableIds: alive.map((p) => p.id),
      };
    case 'POLICE':
      return {
        type: ACTION.POLICE_CHECK,
        prompt: '누구를 조사할까요? 마피아인지 아닌지만 알 수 있습니다.',
        selectableIds: others,
      };
    case 'SPY':
      return {
        type: ACTION.SPY_CONTACT,
        prompt: me.contactSucceeded
          ? '오늘 밤 누구의 직업을 조사할까요?'
          : '누구에게 접선을 시도할까요? 그 사람의 정확한 직업을 알게 됩니다.',
        // 즉시 직업을 알게 되므로 같은 밤에 대상을 바꾸며 여러 명을 훑을 수 없다.
        selectableIds: view.myAction?.type === ACTION.SPY_CONTACT ? [] : others,
      };
    default:
      return null;
  }
}

export default function ActionPrompt({ view }) {
  if (view.phase !== 'NIGHT') return null;

  const action = nightActionFor(view);
  const me = view.me;

  if (!action) {
    if (!me?.alive) {
      return <p className="prompt prompt--quiet">당신은 죽었습니다. 유령 채팅만 쓸 수 있습니다.</p>;
    }
    return <p className="prompt prompt--quiet">밤입니다. 아침을 기다리세요.</p>;
  }

  const picked = view.myAction?.targetId
    ? view.players.find((p) => p.id === view.myAction.targetId)
    : null;

  return (
    <section className="prompt">
      <p className="prompt__ask">{action.prompt}</p>
      <p className="prompt__state">
        {picked
          ? action.type === ACTION.SPY_CONTACT
            ? `${picked.nickname}님의 직업을 확인했습니다. 오늘 조사를 마쳤습니다.`
            : `${picked.nickname}님을 골랐습니다. 바꾸려면 다시 고르세요.`
          : '아래 명단에서 고르세요.'}
      </p>
    </section>
  );
}
