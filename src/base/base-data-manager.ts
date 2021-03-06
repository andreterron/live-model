import { RelationDefinition, RelationInput, RelationPartial, RelationInputObject, RelationsDefinition, RelationSide, LiveList, LiveObject } from './../interfaces/';
import { WrapLiveObject, WrapLiveList } from './wrap-live-object';
import { TeardownLogic } from 'rxjs/Subscription';


export function normalizeRelations(relations: RelationsDefinition, options?: any) {

    function format(name: string): string {
        let replace = (str: string, char?: string) => {
            return str.replace(/([a-z])[-_ ]?([A-Z])/g, (_, $1, $2): string => {
                if (char) {
                    return `${$1}${char}${$2.toLowerCase()}`;
                } else {
                    return `${$1}${$2.toUpperCase()}`;
                }
            });
        }
        switch (options && options.namingConvention || undefined) {
            case 'underline':
                return replace(name, '_');
            case 'dash':
                return replace(name, '-');
            case 'space':
                return replace(name, ' ');
            case 'camelCase':
                return replace(name);
            default:
                return name;
        }
    }
    
    function plural(name: string): string {
        // common exceptions
        if (name === 'child') return 'children';
        // default
        if (name.endsWith('s')) {
            return name;
        } else {
            return name + 's';
        }
    }

    function ensureReverseRelation(type: string, name: string) {
        relations[type] = relations[type] || relations[type] || {}
        return relations[type][name] = relations[type][name] || {to: 'ref'};
    }

    function ensureRelationNames(rel: RelationSide, rev: RelationSide, from: string, fromName: string) {
        rel.name = rel.name || rev.reverseName || fromName;
        rev.name = rev.name || rel.reverseName || from;
        if (rel.name === rev.name) {
            rel.name = format(rel.name + '_to');
            rev.name = format(rev.name + '_from');
        }
    }

    function ensureFromFields(rel: RelationSide, rev: RelationSide, from: string) {
        rel.foreignKey = rel.foreignKey || rev.localKey || format(`${rev.name}_id`);
        rel.localField = rel.localField || rev.foreignField || format(rel.plural || plural(rel.name));
        if (rel.isIndexed && (rel.to === 'many' || rev.to === 'many')) {
            rel.indexField = rel.indexField || rev.indexField || format(`${from}_${rel.name}_index`);
        }
    }

    function ensureEdge(rel: RelationSide, rev: RelationSide, from: string, fromName: string, to: string, toName: string) {
        // Checks if the reverse edge exists
        let revEdgeName = rev.edge || format((rev.name === from || rev.name === to) ? `${to}_${toName}_edge` : rev.name);
        rel.edge = relations[revEdgeName] ? revEdgeName : rel.edge || format(rel.name);
        if (rel.edge === from || rel.edge === to) {
            rel.edge = format(`${from}_${fromName}_edge`)
        }
        
        relations[rel.edge] = relations[rel.edge] || {};
        let edgeFrom = relations[rel.edge][toName] = relations[rel.edge][toName] || {to: 'ref'};
        let edgeTo = relations[rel.edge][fromName] = relations[rel.edge][fromName] || {to: 'ref'};
        let fromToEdge = relations[from][rel.edge] = relations[from][rel.edge] || {to: 'many'};
        let toToEdge = relations[to][rel.edge] = relations[to][rel.edge] || {to: 'many'};

        // Only to:'ref' allowed in edges
        edgeFrom.to = 'ref';
        edgeTo.to = 'ref';

        // Set rev fields
        ensureFromFields(rev, rel, to); // reverse params for correct setup
        rel.foreignField = rel.foreignField || edgeFrom.localField || format(rev.name);
        rev.foreignField = rev.foreignField || edgeTo.localField || format(rel.name);
        rel.edgeField = rel.edgeField || format(plural(rel.edge));
        rev.edgeField = rev.edgeField || format(plural(rel.edge));

        // Edge side: from
        edgeFrom.localField = rel.foreignField;
        edgeFrom.localKey = rel.foreignKey;
        edgeFrom.reverseName = fromName;
        edgeFrom.type = from;
        edgeFrom.name = rel.foreignField
        // Edge side: to
        edgeTo.localField = rev.foreignField;
        edgeTo.localKey = rev.foreignKey;
        edgeTo.reverseName = toName;
        edgeTo.type = to;
        edgeTo.name = rev.foreignField
        // Edge side: from
        fromToEdge.foreignField = rel.foreignField;
        fromToEdge.foreignKey = rel.foreignKey;
        fromToEdge.reverseName = edgeFrom.name;
        fromToEdge.type = rel.edge;
        fromToEdge.name = rel.edge
        // Edge side: to
        toToEdge.foreignField = rev.foreignField;
        toToEdge.foreignKey = rev.foreignKey;
        toToEdge.reverseName = edgeTo.name;
        toToEdge.type = rel.edge;
        toToEdge.name = rel.edge
    }
    
    // Add from relations
    for (var from in relations) {
        for (var fromName in relations[from]) {
            let rel = relations[from][fromName];
            let to = rel.type || fromName;
            let toName = rel.reverseName || from;
            // Creates reference reverse relation if it doesn't exist
            let rev = ensureReverseRelation(to, toName);
            rev.reverseName = fromName;
            rel.type = rel.type || fromName;
            rev.type = from;

            // Check relation type
            if (rel.to === 'many') {
                ensureRelationNames(rel, rev, from, fromName);
                ensureFromFields(rel, rev, from);

                // the reverse of to:'many' should be a to:'ref' or to:'many'
                if (rev.to === 'one') {
                    rev.to = 'ref';
                }

                if (rev.to === 'ref') { // One to Many
                    rev.localKey = rel.foreignKey;
                    rev.localField = rev.localField || rel.foreignField || format(rev.name);
                    rel.foreignField = rev.localField;
                } else if (rev.to === 'many') { // Many to Many
                    ensureEdge(rel, rev, from, fromName, to, toName);
                }
            } else if (rel.to === 'one') {
                if (rev.to === 'one') { // one-to-one (both have references)
                    // Bad use
                    // turn both into 'ref'
                    rel.to = 'ref';
                    rev.to = 'ref';
                    ensureFromFields(rev, rel, to);
                    // ensure mirrored relations
                    rev.localKey = rel.foreignKey;
                    rev.foreignField = rel.localField;
                    rel.localKey = rev.foreignKey;
                    rel.foreignField = rev.localField;
                } else if (rev.to === 'ref') { // one-to-one (rel has rev && rev belongsTo rel)
                    rev.localKey = rel.foreignKey;
                    rev.localField = rev.localField || rel.foreignField || format(rev.name);
                }
            } else if (rel.to === 'ref') {
                // Probably nothing to do here
            }
        }
    }
    return relations;
}

export abstract class BaseDataManager {

    public relations: RelationsDefinition;

    constructor(relations: RelationsDefinition, public options?: any) {
        this.relations = normalizeRelations(relations, options);
    }
    format(name: string): string {
        let replace = (str: string, char?: string) => {
            return str.replace(/([a-z])[-_ ]?([A-Z])/g, (_, $1, $2): string => {
                if (char) {
                    return `${$1}${char}${$2.toLowerCase()}`;
                } else {
                    return `${$1}${$2.toUpperCase()}`;
                }
            });
        }
        switch (this.options && this.options.namingConvention || undefined) {
            case 'underline':
                return replace(name, '_');
            case 'dash':
                return replace(name, '-');
            case 'space':
                return replace(name, ' ');
            case 'camelCase':
                return replace(name);
            default:
                return name;
        }
    }

    fieldKey(name: string): string {
        if (this.options && (this.options.keySuffix === null || (typeof this.options.keySuffix === 'string' && this.options.keySuffix.length === 0))) {
            return this.format(name);
        }
        return this.format(`${name}_${this.options && this.options.keySuffix || 'id'}`)
    }

    fillRelation(relation: RelationPartial): RelationDefinition {
        let reverseName = relation.reverseName || relation.fromType
        return Object.assign(
            {
                localKey: this.fieldKey(relation.name),
                localField: this.format(relation.name),
                reverseName: reverseName,
                indexField: relation.isIndexed ? 'index' : undefined,
                foreignKey: this.fieldKey(reverseName),
                foreignField: this.format(reverseName),
            },
            relation,
            {
                edge: relation.edge ? (typeof relation.edge === 'string' ? {
                    name: relation.edge,
                    localKey: this.fieldKey(relation.name),
                    localField: this.format(relation.name),
                    foreignKey: this.fieldKey(reverseName),
                    foreignField: this.format(reverseName),
                } : Object.assign({
                    name: relation.edge.name,
                    localKey: this.fieldKey(relation.name),
                    localField: this.format(relation.name),
                    foreignKey: this.fieldKey(reverseName),
                    foreignField: this.format(reverseName),
                }, relation.edge)) : undefined
            }
        );
    }

    parseRelation(type: string, input: RelationInput, extra: RelationInputObject): RelationDefinition {
        if (typeof input === 'string') {
            if (this.relations[input]) {
                return this.fillRelation(Object.assign({
                    name: this.relations[type][input].name || input,
                    fromType: type,
                    to: this.relations[type][input].to,
                    toType: this.relations[type][input].type
                }, this.relations[type][input]));
            } else if (extra.to) {
                return this.fillRelation({
                    name: input,
                    fromType: type,
                    to: extra.to,
                    toType: input
                })
            } else {
                throw new Error("Unable to determine size of relation (to many or to one)")
            }
        } else {
            let rel = this.fillRelation(Object.assign({}, input, extra, {
                name: input.name || extra.name || input.toType || extra.toType,
                fromType: type,
                to: input.to || extra.to,
                toType: input.toType || extra.toType || input.name || extra.name
            }));
            if (!rel.name || !rel.to || !rel.toType) {
                throw new Error("Unable to parse relation" + JSON.stringify(input));
            }
            return rel;
        }
    }

    objToOne<T>(type: string, obj: LiveObject<any>, relation: RelationInput, options?: any): LiveObject<T> {
        return new WrapLiveObject<T>((setChild, subscriber): TeardownLogic => {
            var lastObj: T;
            return obj.subscribe((next: T) => {
                try {
                    if (next && (!lastObj || next['id'] != lastObj['id'])) {
                        return setChild(this.toOne<T>(type, next, relation, options));
                    } else if (lastObj && !next) {
                        return setChild(null); // TODO: review this call
                    }
                } catch (e) {
                    subscriber.error(e)
                }
            }, (e) => {subscriber.error(e)}, () => {subscriber.complete()});
        });
    }

    objToMany<T>(type: string, obj: LiveObject<any>, relation: RelationInput, options?: any): LiveList<T> {
        // console.log('OBJ to MANY', type, relation);
        let w = new WrapLiveList<T>((setChild, subscriber): TeardownLogic => {
            var lastObj: T;
            // console.log('OBJ to MANY - lets subscribe', w.depth);
            return obj.subscribe((next: T) => {
                // console.log('OBJ to MANY - got next', w.depth);
                // console.log('Got source object on objToMany', type, relation);
                try {
                    if (next && (!lastObj || next['id'] != lastObj['id'])) {
                        lastObj = next;
                        // console.log('set child to valid', type, relation);
                        let a = this.toMany<T>(type, next, relation, options)
                        // console.log('OBJ to MANY - lets set child', w.depth, a);
                        return setChild(a);
                    } else if (lastObj && !next) {
                        lastObj = next;
                        // console.error('OBJ to MANY - set child to null', type, relation);
                        return setChild(null); // TODO: review this call
                    }
                    lastObj = next;
                    // console.log('no set child', type, relation);
                } catch (e) {
                    // console.error('OBJ to MANY - set child error', type, relation, e);
                    subscriber.error(e)
                }
            }, (e) => {console.error('OBJ to MANY - set child error', type, relation, e); subscriber.error(e)}, () => {subscriber.complete()});
        });
        return w;
    }

    normalizeObject(type: string, obj: any, references?: {[relation: string]: any}, options?: any) {
        return obj;
    }
    
    abstract liveObject<T>(type: string, id: string, options?: any): LiveObject<T>
    abstract liveQuery<T>(type: string, query?: any, options?: any): LiveList<T>
    abstract toMany<T>(type: string, obj: any, relation: RelationInput, options?: any): LiveList<T>
    abstract toOne<T>(type: string, obj: any, relation: RelationInput, options?: any): LiveObject<T>

    abstract save(type: string, obj: any, options?: any): Promise<any>
    abstract create(type: string, obj: any, options?: any): Promise<any>
    abstract delete(type: string, obj: any, options?: any): Promise<any>

    // normalizeRelations(relations: RelationsDefinition) {
    //     // Add from relations
    //     for (var from in relations) {
    //         for (var fromName in relations[from]) {
    //             let rel = relations[from][fromName];
    //             let to = rel.type || fromName;
    //             let toName = rel.reverseName || from;
    //             // Creates reference reverse relation if it doesn't exist
    //             if (!relations[to] || !relations[to][toName]) {
    //                 relations[to] = relations[to] || {}
    //                 relations[to][toName] = {to: 'ref'};
    //             }
    //             let rev = relations[to][toName];

    //             // Check relation type
    //             if (rel.to === 'many') {
    //                 // names
    //                 rel.name = rel.name || fromName;
    //                 rev.name = rev.name || rel.reverseName || from;
    //                 if (rel.name === rev.name) {
    //                     rel.name = this.format(rel.name + '_to');
    //                     rev.name = this.format(rev.name + '_from');
    //                 }

    //                 // relation
    //                 rel.foreignKey = rel.foreignKey || this.format(`${rev.name}_id`);
    //                 rel.localField = rel.localField || this.format(plural(rel.name));
    //                 if (rel.isIndexed) {
    //                     rel.indexField = rel.indexField || this.format(`${rev.name}_index`);
    //                 }
    //                 if (rev.to === 'one') {
    //                     // console.warn(`Relation Mismatch! ${from}->${fromName} is one-to-many, ${to}->${toName} should be have property 'to' = 'ref'`);
    //                     rev.to = 'ref';
    //                 }
    //                 if (rev.to === 'ref') {
    //                     rev.localKey = rel.foreignKey;
    //                     rev.localField = rev.localField || this.format(rev.name);
    //                 } else if (rev.to === 'many') {
    //                     // let edge = rel.edge || this.formatFieldName(rel.name || `${from}_${to}_edge`);
    //                     rel.edge = this.format(rel.name || `${from}_${fromName}_edge`);
    //                     relations[rel.edge] = relations[rel.edge] || {};
    //                     let edgeFrom = relations[rel.edge][toName] = relations[rel.edge][toName] || {to: 'ref'};
    //                     let edgeTo = relations[rel.edge][fromName] = relations[rel.edge][fromName] || {to: 'ref'};
    //                     if (from === to) {
    //                         edgeFrom.localField = edgeFrom.localField || this.format(rev.name);
    //                         edgeFrom.localKey = edgeFrom.localKey || rel.foreignKey;
    //                         edgeTo.localField = edgeTo.localField || this.format(rel.name);
    //                         edgeTo.localKey = edgeTo.localKey || rev.foreignKey;
    //                     } else {
    //                         edgeFrom.localField = edgeFrom.localField || this.format(rev.name);
    //                         edgeFrom.localKey = edgeFrom.localKey || rel.foreignKey;
    //                         edgeTo.localField = edgeTo.localField || this.format(rel.name);
    //                         edgeTo.localKey = edgeTo.localKey || rev.foreignKey;
    //                     }
    //                     rel.foreignKey = rel.foreignKey || this.format(`${from}_id`);
    //                     rel.foreignField = rel.foreignField || this.format(from);
    //                     rel.localField = rel.localField || this.format(plural(from));
    //                 }
    //                 // if rev is to one
    //                 //     ensure reverse ref relation
    //                 // else if rev is to many
    //                 //     ???
    //             } else if (rel.to === 'one') {
                    
    //             } else if (rel.to === 'ref') {
    //                 // Probably nothing to do here
    //             }
    //         }
    //     }
    //     this.relations = relations;
    // }
}