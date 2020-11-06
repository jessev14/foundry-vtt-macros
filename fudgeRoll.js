/**
 * Roll a Skill Check
 * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
 * @param {string} skillId      The skill id (e.g. "ins")
 * @param {Object} options      Options which configure how the skill check is rolled
 * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
 */
function rollSkillFudge(skillId, options = {}) {
    const skl = actor.data.data.skills[skillId];
    const bonuses = getProperty(actor.data.data, "bonuses.abilities") || {};

    // Compose roll parts and data
    const parts = ["@mod"];
    const data = { mod: skl.mod + skl.prof };

    // Ability test bonus
    if (bonuses.check) {
        data["checkBonus"] = bonuses.check;
        parts.push("@checkBonus");
    }

    // Skill check bonus
    if (bonuses.skill) {
        data["skillBonus"] = bonuses.skill;
        parts.push("@skillBonus");
    }

    // Add provided extra roll parts now because they will get clobbered by mergeObject below
    if (options.parts?.length > 0) {
        parts.push(...options.parts);
    }

    // Reliable Talent applies to any skill check we have full or better proficiency in
    const reliableTalent = (skl.value >= 1 && actor.getFlag("dnd5e", "reliableTalent"));

    // Roll and return
    const rollData = mergeObject(options, {
        parts: parts,
        data: data,
        title: game.i18n.format("DND5E.SkillPromptTitle", { skill: CONFIG.DND5E.skills[skillId] }),
        halflingLucky: actor.getFlag("dnd5e", "halflingLucky"),
        reliableTalent: reliableTalent,
        messageData: { "flags.dnd5e.roll": { type: "skill", skillId } }
    });
    rollData.speaker = options.speaker || ChatMessage.getSpeaker({ actor: actor });
    return d20RollFudge(rollData);
};

/**
 * Roll an Ability Test
 * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
 * @param {String} abilityId    The ability ID (e.g. "str")
 * @param {Object} options      Options which configure how ability tests are rolled
 * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
 */
function rollAbilityTestFudge(abilityId, options = {}) {
    const label = CONFIG.DND5E.abilities[abilityId];
    const abl = actor.data.data.abilities[abilityId];

    // Construct parts
    const parts = ["@mod"];
    const data = { mod: abl.mod };

    // Add feat-related proficiency bonuses
    const feats = actor.data.flags.dnd5e || {};
    if (feats.remarkableAthlete && DND5E.characterFlags.remarkableAthlete.abilities.includes(abilityId)) {
        parts.push("@proficiency");
        data.proficiency = Math.ceil(0.5 * actor.data.data.attributes.prof);
    }
    else if (feats.jackOfAllTrades) {
        parts.push("@proficiency");
        data.proficiency = Math.floor(0.5 * actor.data.data.attributes.prof);
    }

    // Add global actor bonus
    const bonuses = getProperty(actor.data.data, "bonuses.abilities") || {};
    if (bonuses.check) {
        parts.push("@checkBonus");
        data.checkBonus = bonuses.check;
    }

    // Add provided extra roll parts now because they will get clobbered by mergeObject below
    if (options.parts?.length > 0) {
        parts.push(...options.parts);
    }

    // Roll and return
    const rollData = mergeObject(options, {
        parts: parts,
        data: data,
        title: game.i18n.format("DND5E.AbilityPromptTitle", { ability: label }),
        halflingLucky: feats.halflingLucky,
        messageData: { "flags.dnd5e.roll": { type: "ability", abilityId } }
    });
    rollData.speaker = options.speaker || ChatMessage.getSpeaker({ actor: actor });
    return d20RollFudge(rollData);
};

/**
   * Roll an Ability Saving Throw
   * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
   * @param {String} abilityId    The ability ID (e.g. "str")
   * @param {Object} options      Options which configure how ability tests are rolled
   * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
   */
function rollAbilitySaveFudge(abilityId, options = {}) {
    const label = CONFIG.DND5E.abilities[abilityId];
    const abl = actor.data.data.abilities[abilityId];

    // Construct parts
    const parts = ["@mod"];
    const data = { mod: abl.mod };

    // Include proficiency bonus
    if (abl.prof > 0) {
        parts.push("@prof");
        data.prof = abl.prof;
    }

    // Include a global actor ability save bonus
    const bonuses = getProperty(actor.data.data, "bonuses.abilities") || {};
    if (bonuses.save) {
        parts.push("@saveBonus");
        data.saveBonus = bonuses.save;
    }

    // Add provided extra roll parts now because they will get clobbered by mergeObject below
    if (options.parts?.length > 0) {
        parts.push(...options.parts);
    }

    // Roll and return
    const rollData = mergeObject(options, {
        parts: parts,
        data: data,
        title: game.i18n.format("DND5E.SavePromptTitle", { ability: label }),
        halflingLucky: actor.getFlag("dnd5e", "halflingLucky"),
        messageData: { "flags.dnd5e.roll": { type: "save", abilityId } }
    });
    rollData.speaker = options.speaker || ChatMessage.getSpeaker({ actor: actor });
    return d20RollFudge(rollData);
};

/**
 * Place an attack roll using an item (weapon, feat, spell, or equipment)
 * Rely upon the d20Roll logic for the core implementation
 *
 * @param {object} options        Roll options which are configured and provided to the d20Roll function
 * @return {Promise<Roll|null>}   A Promise which resolves to the created Roll instance
 */
async function rollAttackFudge(item, options = {}) {
    const itemOwned = actor.items.find(i => i.data._id == item);
    const itemData = itemOwned.data.data;
    const actorData = actor.data.data;
    const flags = actor.data.flags.dnd5e || {};
    if (!itemOwned.hasAttack) {
        throw new Error("You may not place an Attack Roll with this Item.");
    }
    let title = `${itemOwned.name} - ${game.i18n.localize("DND5E.AttackRoll")}`;
    const rollData = itemOwned.getRollData();

    // Define Roll bonuses
    const parts = [`@mod`];
    if ((itemOwned.data.type !== "weapon") || itemData.proficient) {
        parts.push("@prof");
    }

    // Attack Bonus
    const actorBonus = actorData?.bonuses?.[itemData.actionType] || {};
    if (itemData.attackBonus || actorBonus.attack) {
        parts.push("@atk");
        rollData["atk"] = [itemData.attackBonus, actorBonus.attack].filterJoin(" + ");
    }

    // Ammunition Bonus
    delete itemOwned._ammo;
    const consume = itemData.consume;
    if (consume?.type === "ammo") {
        const ammo = itemOwned.actor.items.get(consume.target);
        if (ammo?.data) {
            const q = ammo.data.data.quantity;
            const consumeAmount = consume.amount ?? 0;
            if (q && (q - consumeAmount >= 0)) {
                let ammoBonus = ammo.data.data.attackBonus;
                if (ammoBonus) {
                    parts.push("@ammo");
                    rollData["ammo"] = ammoBonus;
                    title += ` [${ammo.name}]`;
                    itemOwned._ammo = ammo;
                }
            }
        }
    }

    // Compose roll options
    const rollConfig = mergeObject({
        parts: parts,
        actor: actor,
        data: rollData,
        title: title,
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        dialogOptions: {
            width: 400,
            top: options.event ? options.event.clientY - 80 : null,
            left: window.innerWidth - 710
        },
        messageData: { "flags.dnd5e.roll": { type: "attack", itemId: itemOwned.id } }
    }, options);
    rollConfig.event = options.event;

    // Expanded weapon critical threshold
    if ((itemOwned.data.type === "weapon") && flags.weaponCriticalThreshold) {
        rollConfig.critical = parseInt(flags.weaponCriticalThreshold);
    }

    // Elven Accuracy
    if (["weapon", "spell"].includes(itemOwned.data.type)) {
        if (flags.elvenAccuracy && ["dex", "int", "wis", "cha"].includes(itemOwned.abilityMod)) {
            rollConfig.elvenAccuracy = true;
        }
    }

    // Apply Halfling Lucky
    if (flags.halflingLucky) rollConfig.halflingLucky = true;

    // Invoke the d20 roll helper
    const roll = await d20RollFudge(rollConfig);
    if (roll === false) return null;

    // Handle resource consumption if the attack roll was made
    const allowed = await this._handleResourceConsumption({ isCard: false, isAttack: true });
    if (allowed === false) return null;
    return roll;
};

/**
 * A standardized helper function for managing core 5e "d20 rolls"
 *
 * Holding SHIFT, ALT, or CTRL when the attack is rolled will "fast-forward".
 * This chooses the default options of a normal attack with no bonus, Advantage, or Disadvantage respectively
 *
 * @param {Array} parts             The dice roll component parts, excluding the initial d20
 * @param {Object} data             Actor or item data against which to parse the roll
 * @param {Event|object} event      The triggering event which initiated the roll
 * @param {string} rollMode         A specific roll mode to apply as the default for the resulting roll
 * @param {string|null} template    The HTML template used to render the roll dialog
 * @param {string|null} title       The dice roll UI window title
 * @param {Object} speaker          The ChatMessage speaker to pass when creating the chat
 * @param {string|null} flavor      Flavor text to use in the posted chat message
 * @param {Boolean} fastForward     Allow fast-forward advantage selection
 * @param {Function} onClose        Callback for actions to take when the dialog form is closed
 * @param {Object} dialogOptions    Modal dialog options
 * @param {boolean} advantage       Apply advantage to the roll (unless otherwise specified)
 * @param {boolean} disadvantage    Apply disadvantage to the roll (unless otherwise specified)
 * @param {number} critical         The value of d20 result which represents a critical success
 * @param {number} fumble           The value of d20 result which represents a critical failure
 * @param {number} targetValue      Assign a target value against which the result of this roll should be compared
 * @param {boolean} elvenAccuracy   Allow Elven Accuracy to modify this roll?
 * @param {boolean} halflingLucky   Allow Halfling Luck to modify this roll?
 * @param {boolean} reliableTalent  Allow Reliable Talent to modify this roll?
 * @param {boolean} chatMessage     Automatically create a Chat Message for the result of this roll
 * @param {object} messageData      Additional data which is applied to the created Chat Message, if any
 *
 * @return {Promise}                A Promise which resolves once the roll workflow has completed
 */
async function d20RollFudge({ parts = [], data = {}, event = {}, rollMode = null, template = null, title = null, speaker = null,
    flavor = null, fastForward = null, dialogOptions,
    advantage = null, disadvantage = null, critical = 20, fumble = 1, targetValue = null,
    elvenAccuracy = false, halflingLucky = false, reliableTalent = false,
    chatMessage = true, messageData = {}, target = null } = {}) {

    // Prepare Message Data
    messageData.flavor = flavor || title;
    messageData.speaker = speaker || ChatMessage.getSpeaker();
    const messageOptions = { rollMode: rollMode || game.settings.get("core", "rollMode") };
    parts = parts.concat(["@bonus"]);

    // Handle fast-forward events
    let adv = 0;
    fastForward = fastForward ?? (event && (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey));
    if (fastForward) {
        if (advantage || event.altKey) adv = 1;
        else if (disadvantage || event.ctrlKey || event.metaKey) adv = -1;
    }


    // Define the inner roll function
    const _roll = (parts, adv, form, target) => {

        // Determine the d20 roll and modifiers
        let nd = 1;
        let mods = halflingLucky ? "r=1" : "";

        // Handle advantage
        if (adv === 1) {
            nd = elvenAccuracy ? 3 : 2;
            messageData.flavor += ` (${game.i18n.localize("DND5E.Advantage")})`;
            if ("flags.dnd5e.roll" in messageData) messageData["flags.dnd5e.roll"].advantage = true;
            mods += "kh";
        }

        // Handle disadvantage
        else if (adv === -1) {
            nd = 2;
            messageData.flavor += ` (${game.i18n.localize("DND5E.Disadvantage")})`;
            if ("flags.dnd5e.roll" in messageData) messageData["flags.dnd5e.roll"].disadvantage = true;
            mods += "kl";
        }

        // Prepend the d20 roll
        let formula = `${nd}d20${mods}`;
        if (reliableTalent) formula = `{${nd}d20${mods},10}kh`;
        parts.unshift(formula);

        // Optionally include a situational bonus
        if (form) {
            data['bonus'] = form.bonus.value;
            messageOptions.rollMode = form.rollMode.value;
        }
        if (!data["bonus"]) parts.pop();

        // Optionally include an ability score selection (used for tool checks)
        const ability = form ? form.ability : null;
        if (ability && ability.value) {
            data.ability = ability.value;
            const abl = data.abilities[data.ability];
            if (abl) {
                data.mod = abl.mod;
                messageData.flavor += ` (${CONFIG.DND5E.abilities[data.ability]})`;
            }
        }

        // Execute the roll


        try {
            function recursiveRoll(parts, data, target) {

                const mn = new Roll(parts.join(" + "), data).evaluate({ minmize: true }).total;
                const mx = new Roll(parts.join(" + "), data).evaluate({ maximize: true }).total;

                if (target > mx || target < mn) {
                    return new Roll(parts.join(" + "), data).roll();
                };


                if (isNaN(target)) {
                    let r = new Roll(parts.join(" + "), data).evaluate({ maximize: true });
                    return r;
                };
                let r = new Roll(parts.join(" + "), data).roll();
                if (r.total !== target) {
                    r = recursiveRoll(parts, data, target);
                };
                return r;
            };

            var roll = recursiveRoll(parts, data, target);

        } catch (err) {
            console.error(err);
            ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
            return null;
        }

        // Flag d20 options for any 20-sided dice in the roll
        for (let d of roll.dice) {
            if (d.faces === 20) {
                d.options.critical = critical;
                d.options.fumble = fumble;
                if (targetValue) d.options.target = targetValue;
            }
        }

        // If reliable talent was applied, add it to the flavor text
        if (reliableTalent && roll.dice[0].total < 10) {
            messageData.flavor += ` (${game.i18n.localize("DND5E.FlagsReliableTalent")})`;
        }
        return roll;
    };

    // Create the Roll instance
    const roll = fastForward ? _roll(parts, adv) :
        await _d20RollDialog({ template, title, parts, data, target, rollMode: messageOptions.rollMode, dialogOptions, roll: _roll });

    // Create a Chat Message
    if (roll && chatMessage) roll.toMessage(messageData, messageOptions);
    return roll;
};

/**
 * Present a Dialog form which creates a d20 roll once submitted
 * @return {Promise<Roll>}
 * @private
 */
async function _d20RollDialog({ template, title, parts, data, target, rollMode, dialogOptions, roll } = {}) {

    // Render modal dialog
    template = template || "systems/dnd5e/templates/chat/roll-dialog.html";
    let dialogData = {
        formula: parts.join(" + "),
        data: data,
        rollMode: rollMode,
        rollModes: CONFIG.Dice.rollModes,
        config: CONFIG.DND5E
    };
    const html = await renderTemplate(template, dialogData);

    // Create the Dialog window
    return new Promise(resolve => {
        new Dialog({
            title: title,
            content: html,
            buttons: {
                advantage: {
                    label: game.i18n.localize("DND5E.Advantage"),
                    callback: html => resolve(roll(parts, 1, html[0].querySelector("form"), target))
                },
                normal: {
                    label: game.i18n.localize("DND5E.Normal"),
                    callback: html => resolve(roll(parts, 0, html[0].querySelector("form"), target))
                },
                disadvantage: {
                    label: game.i18n.localize("DND5E.Disadvantage"),
                    callback: html => resolve(roll(parts, -1, html[0].querySelector("form"), target))
                }
            },
            default: "normal",
            close: () => resolve(null)
        }, dialogOptions).render(true);
    });
};

function lastItemID() {
    const content = game.messages
        .filter(message => message.data.content.includes(`dnd5e chat-card item-card`))
        .pop().data.content;
    const itemID = /data-item-id="(.*?)"/g.exec(content)[1];
    return itemID;
};

let skills = `
    <option value=acr>Acrobatics</option>,
    <option value=ani>Animal Handling</option>,
    <option value=arc>Arcana</option>,
    <option value=ath>Athletics</option>,
    <option value=dec>Deception</option>,
    <option value=his>History</option>,
    <option value=ins>Insight</option>,
    <option value=inv>Investigation</option>,
    <option value=itm>Intimidation</option>,
    <option value=med>Medicine</option>,
    <option value=nat>Nature</option>,
    <option value=prc>Perception</option>,
    <option value=prf>Performance</option>,
    <option value=per>Persuasion</option>,
    <option value=re>Religion</option>,
    <option value=slt>Sleight of Hand</option>,
    <option value=ste>Stealth</option>,
    <option value=sur>Survival</option>
`;

let abilities = `
    <option value=str>Strength</option>,
    <option value=dex>Dexterity</option>,
    <option value=con>Constitution</option>,
    <option value=int>Intelligence</option>,
    <option value=wis>Wisdom</option>,
    <option value=cha>Charisma</option>,
`;

let dialogContent = `
<div>
    <label><input type="radio" id="skillRadio" name="rollType" value="skillCheck" checked> Skill Check</label>
    <select id="skillSelect">${skills}</select>
</div>

<div>
    <label><input type="radio" id="abilityRadio" name="rollType" value="abilityCheck"> Ability Check</label>
    <select id="abilitySelect">${abilities}</select>
</div>

<div>
    <label><input type="radio" id="saveRadio" name="rollType" value="savingThrow"> Saving Throw</label>
    <select id="saveSelect">${abilities}</select>
</div>

<div>
    <label><input type="radio" id="attackRadio" name="rollType" value="attackRoll"> Attack Roll</label>
</div>

<div>
    Target: <input id="target" type="number" style="width:50px" />
</div>
`;


new Dialog({
    title: "Fudge Roll",
    content: dialogContent,
    buttons: {
        fudgeRoll: {
            label: "Fudge Roll",
            callback: async (html) => {
                const tgt = parseInt(html.find("#target")[0].value);

                if (html.find("#skillRadio")[0].checked) {
                    const skillId = html.find("#skillSelect")[0].value;
                    rollSkillFudge(skillId, { target: tgt });
                } else if (html.find("#abilityRadio")[0].checked) {
                    const abilityId = html.find("#abilitySelect")[0].value;
                    rollAbilityTestFudge(abilityId, { target: tgt });
                } else if (html.find("#saveRadio")[0].checked) {
                    const abilityId = html.find("#saveSelect")[0].value;
                    rollAbilitySaveFudge(abilityId, { target: tgt });
                } else {
                    const attackId = lastItemID();
                    if (attackId) {
                        rollAttackFudge(attackId, { target: tgt });
                    };
                };
            }
        }
    }
}).render(true);